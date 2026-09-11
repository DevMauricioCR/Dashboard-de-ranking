const BASE_URL = 'https://api.hubapi.com';

// Acepta el token como Variable de n8n (Settings > Variables). OJO: no se usa
// $env como fallback -- n8n Cloud bloquea el acceso a $env desde el Code node y
// tira "access to env vars denied" apenas se intenta leer, incluso dentro de un ||.
// Si tu plan no incluye Variables, reemplaza la línea de abajo por el token real
// directo (const token = 'pat-...';) -- solo aquí dentro de n8n, nunca en este
// archivo si lo vas a guardar/compartir/subir a un repo.
const token = $vars.HUBSPOT_ACCESS_TOKEN;

if (!token) {
  throw new Error('Falta HUBSPOT_ACCESS_TOKEN: crea una Variable o env var con ese nombre en n8n');
}

// $input toma el JSON del nodo conectado directamente a este Code node (el
// Webhook), sin depender de su nombre exacto — evita romperse si el nodo se
// renombra (p.ej. "Webhook" vs "Webhook1").
const query = $input.first().json.query || {};
const periodo = query.periodo || 'mensual';
const staticData = $getWorkflowStaticData('global');
// Evita reutilizar datasets guardados por constructores antiguos. Súbela cada
// vez que cambie la forma del payload (p.ej. v5: año/trimestre/mes-pasado
// devuelven "ranking" agregado en vez de "deals" completos).
const DATASET_SCHEMA_VERSION = 'v15-nuevo-negocio-todas-pipelines';
const cacheKey = `dashboard:${DATASET_SCHEMA_VERSION}:${periodo}`;

// TTL por periodo: "diario" alimenta la Pantalla 1 en vivo y necesita
// frescura; mensual/anual/trimestral son datasets más pesados que cambian
// poco minuto a minuto, así que se refrescan con menos frecuencia. Un
// cacheTtlMs explícito en el query sigue pisando este valor por defecto.
const PERIOD_TTL_MS = {
  diario: 5 * 60_000, // el dashboard hace polling cada 5 min para Día
  mensual: 60 * 60_000, // el dashboard hace polling cada 1h para Mes
  anual: 300_000,
  trimestral: 300_000,
  mes_pasado: 300_000,
  mes_anterior: 300_000,
};
const cacheTtlMs = Number(query.cacheTtlMs) || PERIOD_TTL_MS[periodo] || 120000;
const cached = staticData[cacheKey];

if (
  query.force !== 'true' &&
  cached?.payload &&
  !staticData.cacheDirty &&
  Date.now() - cached.savedAt < cacheTtlMs
) {
  return [{
    json: {
      ...cached.payload,
      datasetSchemaVersion: DATASET_SCHEMA_VERSION,
      cache: {
        hit: true,
        savedAt: cached.savedAt,
        ageMs: Date.now() - cached.savedAt,
        dirty: Boolean(staticData.cacheDirty)
      }
    }
  }];
}

function getPeriodRange(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric', month: 'numeric', day: 'numeric'
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map(({ type, value: partValue }) => [type, Number(partValue)])
  );
  const year = values.year;
  const monthIndex = values.month - 1;
  const day = values.day;
  // Ciudad de México permanece en UTC-6; se construyen límites exactos en UTC.
  const mexicoStart = (y, m, d) => new Date(Date.UTC(y, m, d, 6, 0, 0, 0));
  const mexicoEnd = (y, m, d) => new Date(Date.UTC(y, m, d + 1, 5, 59, 59, 999));

  let start = mexicoStart(year, monthIndex, day);
  let end = mexicoEnd(year, monthIndex, day);

  if (value === 'diario') return { start, end };

  if (value === 'mes_pasado' || value === 'mes_anterior') {
    start = mexicoStart(year, monthIndex - 1, 1);
    end = new Date(mexicoStart(year, monthIndex, 1).getTime() - 1);
    return { start, end };
  }

  if (value === 'trimestral') {
    const quarterStartMonth = Math.floor(monthIndex / 3) * 3;
    start = mexicoStart(year, quarterStartMonth, 1);
    return { start, end };
  }

  if (value === 'anual') {
    start = mexicoStart(year, 0, 1);
    return { start, end };
  }

  start = mexicoStart(year, monthIndex, 1);
  return { start, end };
}

const { start, end } = getPeriodRange(periodo);
const n8nContext = this;

async function hubspotFetch(path, options = {}) {
  const requestOptions = {
    method: options.method || 'GET',
    url: `${BASE_URL}${path}`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    json: true
  };

  if (options.body) {
    requestOptions.body = typeof options.body === 'string'
      ? JSON.parse(options.body)
      : options.body;
  }

  return await n8nContext.helpers.httpRequest(requestOptions);
}

function chunkArray(arr, size = 100) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// Trae negocios que CERRARON en el periodo O que se CREARON en el periodo (las dos
// condiciones, no solo una). Un negocio se puede crear un día y su fecha de cierre
// quedar registrada un día distinto (antes o después) -- si solo miráramos closedate,
// un negocio creado hoy pero con closedate de ayer no contaría como "de hoy" en
// ningún lado, aunque para el asesor sí fue una venta de hoy. HubSpot Search API: cada
// filterGroup se evalúa con OR entre sí (los filters DENTRO de un grupo son AND).
//
// Este mismo resultado alimenta TAMBIÉN el snapshot del embudo (ver getEmbudoSnapshot,
// que filtra este arreglo en memoria a solo los negocios con createdate en el
// periodo) -- antes había una segunda búsqueda aparte a HubSpot solo para eso, con
// bastante traslape con esta, y las dos juntas se acercaban al rate limit (429) de la
// API. Por eso pide 'dealtype' aunque searchDeals() en sí no lo usaba.
const DEALS_PAGE_CAP = 50; // tope duro de seguridad: 50 páginas x 100 = 5000 negocios

// Pipelines que NO son del equipo de asesores (ventas online) y que el tablero de
// HubSpot "Equipo Comercial" tampoco muestra -- se excluyen para que el dashboard
// cuadre con ese tablero. Confirmado con el usuario: "889232491" es "Ventas
// consultoria" (no sirve, ignorar). "933313851" es el pipeline de "Seguimiento
// consultoría 2026" (negocios de Jessica/Deborah, siempre en $0) -- misma categoría,
// se excluye igual para que el conteo de negocios también cuadre.
const EXCLUDED_PIPELINE_IDS = ['889232491', '933313851'];

async function searchDeals() {
  const deals = [];
  let after = null;
  let page = 0;
  const pipelineExclusions = EXCLUDED_PIPELINE_IDS.map(id => ({
    propertyName: 'pipeline',
    operator: 'NEQ',
    value: id
  }));

  do {
    const body = {
      filterGroups: [
        {
          filters: [
            { propertyName: 'closedate', operator: 'GTE', value: String(start.getTime()) },
            { propertyName: 'closedate', operator: 'LTE', value: String(end.getTime()) },
            ...pipelineExclusions
          ]
        },
        {
          filters: [
            { propertyName: 'createdate', operator: 'GTE', value: String(start.getTime()) },
            { propertyName: 'createdate', operator: 'LTE', value: String(end.getTime()) },
            ...pipelineExclusions
          ]
        }
      ],
      properties: [
        'dealname',
        'amount',
        'dealstage',
        'pipeline',
        'closedate',
        'createdate',
        'hs_lastmodifieddate',
        'hubspot_owner_id',
        'dealtype'
      ],
      limit: 100
      // OJO: SIN "sorts". Confirmado con pruebas directas a la API: combinar varios
      // filterGroups (OR, como los dos de arriba) con un "sorts" hace que HubSpot
      // devuelva de menos -- se comieron negocios reales (ver conversación). Sin
      // "sorts" HubSpot regresa la unión completa y correcta.
    };

    if (after) body.after = after;

    const data = await hubspotFetch('/crm/v3/objects/deals/search', {
      method: 'POST',
      body
    });

    deals.push(...(data.results || []));
    after = data.paging?.next?.after || null;
    page += 1;
  } while (after && page < DEALS_PAGE_CAP);

  return deals;
}

async function searchCalls() {
  const calls = [];
  let after = null;

  do {
    const body = {
      filterGroups: [{
        filters: [
          {
            propertyName: 'hs_timestamp',
            operator: 'GTE',
            value: String(start.getTime())
          },
          {
            propertyName: 'hs_timestamp',
            operator: 'LTE',
            value: String(end.getTime())
          }
        ]
      }],
      properties: [
        'hs_timestamp',
        'hs_call_title',
        'hs_call_status',
        'hs_call_duration',
        'hs_call_direction',
        'hubspot_owner_id'
      ],
      limit: 100,
      sorts: [{
        propertyName: 'hs_timestamp',
        direction: 'DESCENDING'
      }]
    };

    if (after) body.after = after;

    const data = await hubspotFetch('/crm/v3/objects/calls/search', {
      method: 'POST',
      body
    });

    calls.push(...(data.results || []));
    after = data.paging?.next?.after || null;
  } while (after);

  return calls;
}

// --- Catálogos (owners, users, stage labels) ---
// Cambian muy poco frente a deals/calls, así que se separan del cache por
// periodo y se guardan con su propio TTL largo (ver getCatalogs). Cada
// "fetch*Raw" solo trae datos crudos de HubSpot; cada "build*Map" arma el
// Map de consulta a partir de esos datos crudos, ya sea recién traídos o
// recuperados del cache. Así el cache guarda arreglos planos (serializables)
// en vez de Maps.

async function fetchPipelinesRaw() {
  const data = await hubspotFetch('/crm/v3/pipelines/deals');
  return data.results || [];
}

function buildStageLabelMap(pipelines) {
  const map = new Map();
  for (const pipeline of pipelines || []) {
    for (const stage of pipeline.stages || []) {
      if (stage.id) {
        map.set(String(stage.id), stage.label || stage.id);
      }
    }
  }
  return map;
}

// Probabilidad de cada etapa (0-1), tal como la configura el pipeline en HubSpot.
// Es la base de "cantidad ponderada de negocio" (amount * probabilidad de su etapa).
function buildStageProbabilityMap(pipelines) {
  const map = new Map();
  for (const pipeline of pipelines || []) {
    for (const stage of pipeline.stages || []) {
      if (stage.id) {
        map.set(String(stage.id), Number(stage.metadata?.probability || 0));
      }
    }
  }
  return map;
}

async function fetchOwnersRaw() {
  const owners = [];
  const archivedModes = [false, true];

  for (const archived of archivedModes) {
    let after = null;

    do {
      const path =
        `/crm/v3/owners/?limit=100&archived=${archived}` +
        (after ? `&after=${after}` : '');
      const data = await hubspotFetch(path);

      owners.push(...(data.results || []));
      after = data.paging?.next?.after || null;
    } while (after);
  }

  return owners;
}

function buildOwnerMap(owners) {
  const map = new Map();
  for (const owner of owners || []) {
    if (owner.id) map.set(String(owner.id), owner);
    if (owner.userId) map.set(String(owner.userId), owner);
  }
  return map;
}

async function fetchUsersRaw() {
  const users = [];
  let after = null;

  do {
    const path =
      '/crm/objects/2026-03/users' +
      '?limit=100' +
      '&properties=hs_email,hs_given_name,hs_family_name,hs_job_title' +
      (after ? `&after=${after}` : '');

    const data = await hubspotFetch(path);

    users.push(...(data.results || []));
    after = data.paging?.next?.after || null;
  } while (after);

  return users;
}

function buildUserMap(users) {
  const map = new Map();
  for (const user of users || []) {
    const props = user.properties || {};
    if (user.id) map.set(String(user.id), user);
    if (props.hs_email) {
      map.set(String(props.hs_email).toLowerCase(), user);
    }
  }
  return map;
}

// OJO: clave FIJA, sin DATASET_SCHEMA_VERSION -- owners/users/pipelines no cambian de
// forma cuando cambia el payload de deals/embudo, así que no tiene por qué invalidarse
// cada vez que se sube DATASET_SCHEMA_VERSION. Subir la versión del dataset (para
// invalidar el cache de deals/embudo) NO debe forzar un refetch completo del catálogo
// -- eso fue justo lo que generó varios 429 seguidos mientras se probaban los cambios.
const CATALOG_CACHE_KEY = 'catalog:v1';
const CATALOG_TTL_MS = 24 * 60 * 60 * 1000; // owners/users/stages casi no cambian

// Memoiza la promesa EN CURSO (no solo el resultado ya guardado): con cache frío,
// getEmbudoSnapshot() y el resto de buildDetailedPayload() piden el catálogo casi al
// mismo tiempo, y sin esto cada uno dispara su propio fetch completo a HubSpot en
// paralelo — duplicando owners/users/pipelines de un solo golpe y acercando la
// ejecución al límite de rate limit (429) de la API.
let catalogsInFlight = null;

async function getCatalogs() {
  const cachedCatalog = staticData[CATALOG_CACHE_KEY];
  const isFresh = cachedCatalog && Date.now() - cachedCatalog.savedAt < CATALOG_TTL_MS;

  if (isFresh && query.force !== 'true') {
    return {
      ownerMap: buildOwnerMap(cachedCatalog.owners),
      userMap: buildUserMap(cachedCatalog.users),
      stageLabelMap: buildStageLabelMap(cachedCatalog.pipelines),
      stageProbabilityMap: buildStageProbabilityMap(cachedCatalog.pipelines),
    };
  }

  if (catalogsInFlight) return catalogsInFlight;

  catalogsInFlight = (async () => {
    const [owners, users, pipelines] = await Promise.all([
      fetchOwnersRaw(),
      fetchUsersRaw(),
      fetchPipelinesRaw(),
    ]);

    staticData[CATALOG_CACHE_KEY] = { savedAt: Date.now(), owners, users, pipelines };

    return {
      ownerMap: buildOwnerMap(owners),
      userMap: buildUserMap(users),
      stageLabelMap: buildStageLabelMap(pipelines),
      stageProbabilityMap: buildStageProbabilityMap(pipelines),
    };
  })();

  try {
    return await catalogsInFlight;
  } finally {
    catalogsInFlight = null;
  }
}

async function batchReadAssociations(fromObjectType, toObjectType, fromIds) {
  const map = new Map();
  const uniqueIds = [...new Set(fromIds.map(String))].filter(Boolean);
  if (!uniqueIds.length) return map;

  for (const chunk of chunkArray(uniqueIds, 100)) {
    const data = await hubspotFetch(
      `/crm/v4/associations/${fromObjectType}/${toObjectType}/batch/read`,
      {
        method: 'POST',
        body: {
          inputs: chunk.map(id => ({ id }))
        }
      }
    );

    for (const result of data.results || []) {
      const fromId = String(
        result.from?.id ||
        result._from?.id ||
        result.id ||
        ''
      );

      const toIds = (result.to || [])
        .map(item => String(item.toObjectId || item.id || ''))
        .filter(Boolean);

      if (fromId) map.set(fromId, toIds);
    }
  }

  return map;
}

async function batchReadObjects(objectType, ids, properties) {
  const map = new Map();
  const uniqueIds = [...new Set(ids.map(String))].filter(Boolean);
  if (!uniqueIds.length) return map;

  for (const chunk of chunkArray(uniqueIds, 100)) {
    const data = await hubspotFetch(
      `/crm/v3/objects/${objectType}/batch/read`,
      {
        method: 'POST',
        body: {
          properties,
          inputs: chunk.map(id => ({ id }))
        }
      }
    );

    for (const item of data.results || []) {
      map.set(String(item.id), item);
    }
  }

  return map;
}

// Construye el dataset "detallado": trae deals + calls + contactos + line
// items con todas sus asociaciones. Lo necesitan Día (llamadas) y Mes
// (llamadas + interesados/promesas vía hs_lead_status del contacto).
async function buildDetailedPayload() {
  const startedAt = Date.now();

  // Deals y llamadas se consultan simultáneamente.
  const [deals, calls] = await Promise.all([
    searchDeals(),
    searchCalls()
  ]);

  // El embudo reusa este mismo "deals" (filtrando en memoria a los que tienen
  // createdate en el periodo) en vez de volver a pedirle a HubSpot -- ver el
  // comentario en searchDeals().
  const embudoPromise = getEmbudoSnapshot(periodo, deals);

const dealIds = deals.map(deal => String(deal.id));
const callIds = calls.map(call => String(call.id));

const [
  catalogs,
  contactAssociations,
  lineItemAssociations,
  callContactAssociations,
  callDealAssociations
] = await Promise.all([
  getCatalogs(),
  batchReadAssociations('deals', 'contacts', dealIds),
  batchReadAssociations('deals', 'line_items', dealIds),
  batchReadAssociations('calls', 'contacts', callIds),
  batchReadAssociations('calls', 'deals', callIds)
]);

const { ownerMap, userMap, stageLabelMap } = catalogs;

const contactIds = [...new Set([
  ...[...contactAssociations.values()].flat(),
  ...[...callContactAssociations.values()].flat()
])];

const lineItemIds = [...new Set(
  [...lineItemAssociations.values()].flat()
)];

const [contactMap, lineItemMap] = await Promise.all([
  batchReadObjects(
    'contacts',
    contactIds,
    ['firstname', 'lastname', 'email', 'phone', 'company', 'hs_lead_status']
  ),
  batchReadObjects(
    'line_items',
    lineItemIds,
    [
      'name',
      'quantity',
      'price',
      'amount',
      'hs_product_id',
      'hs_sku'
    ]
  )
]);

const normalizedCalls = calls.map(call => {
  const props = call.properties || {};

  return {
    id: String(call.id),
    ownerId: props.hubspot_owner_id
      ? String(props.hubspot_owner_id)
      : null,
    timestamp: props.hs_timestamp || null,
    title: props.hs_call_title || null,
    status: props.hs_call_status || null,
    direction: props.hs_call_direction || null,
    duration: Number(props.hs_call_duration || 0),
    contactIds:
      callContactAssociations.get(String(call.id)) || [],
    dealIds:
      callDealAssociations.get(String(call.id)) || []
  };
});

const callsByOwner = new Map();
const callsByContact = new Map();
const callsByDeal = new Map();

for (const call of normalizedCalls) {
  if (call.ownerId) {
    const ownerCalls = callsByOwner.get(call.ownerId) || [];
    ownerCalls.push(call);
    callsByOwner.set(call.ownerId, ownerCalls);
  }

  for (const contactId of call.contactIds) {
    const contactCalls = callsByContact.get(String(contactId)) || [];
    contactCalls.push(call);
    callsByContact.set(String(contactId), contactCalls);
  }

  for (const dealId of call.dealIds) {
    const dealCalls = callsByDeal.get(String(dealId)) || [];
    dealCalls.push(call);
    callsByDeal.set(String(dealId), dealCalls);
  }
}

const result = deals.map(deal => {
  const props = deal.properties || {};
  const dealId = String(deal.id);
  const ownerId = props.hubspot_owner_id
    ? String(props.hubspot_owner_id)
    : null;

  const owner = ownerId
    ? ownerMap.get(ownerId) || null
    : null;

  const ownerUser = owner
    ? userMap.get(String(owner.email || '').toLowerCase()) ||
      userMap.get(String(owner.userId || '')) ||
      userMap.get(String(owner.id || '')) ||
      null
    : null;

  const ownerUserProps = ownerUser?.properties || {};

  const contacts = (contactAssociations.get(dealId) || [])
    .map(id => contactMap.get(String(id)))
    .filter(Boolean)
    .map(contact => {
      const contactCalls =
        callsByContact.get(String(contact.id)) || [];

      return {
        id: contact.id,
        firstname: contact.properties?.firstname || null,
        lastname: contact.properties?.lastname || null,
        email: contact.properties?.email || null,
        phone: contact.properties?.phone || null,
        company: contact.properties?.company || null,
        // Propiedad estándar de HubSpot "Estado del lead" (Contacto). Alimenta
        // las columnas Interesados / Promesa de pago / Cerrados de Pantalla 3.
        estadoLead: contact.properties?.hs_lead_status || null,
        totalLlamadas: contactCalls.length,
        ultimaLlamada: contactCalls[0]?.timestamp || null,
        callIds: contactCalls.map(call => call.id)
      };
    });

  const lineItems = (lineItemAssociations.get(dealId) || [])
    .map(id => lineItemMap.get(String(id)))
    .filter(Boolean)
    .map(item => ({
      id: item.id,
      name: item.properties?.name || null,
      quantity: item.properties?.quantity || null,
      price: item.properties?.price || null,
      amount: item.properties?.amount || null,
      hs_product_id: item.properties?.hs_product_id || null,
      sku: item.properties?.hs_sku || null
    }));

  const directDealCalls = callsByDeal.get(dealId) || [];

  // Evita contar dos veces una misma llamada asociada al deal y al contacto.
  const relatedCallIds = new Set([
    ...directDealCalls.map(call => call.id),
    ...contacts.flatMap(contact => contact.callIds || [])
  ]);

  return {
    dealId: deal.id,
    dealName: props.dealname || null,
    amount: props.amount || null,
    dealStage: props.dealstage || null,
    dealStageLabel: props.dealstage
      ? stageLabelMap.get(String(props.dealstage)) || null
      : null,
    pipeline: props.pipeline || null,
    closeDate: props.closedate || null,
    createDate: props.createdate || null,
    lastModifiedDate: props.hs_lastmodifieddate || null,
    hubspotOwnerId: ownerId,
    totalLlamadas: relatedCallIds.size,
    callIds: [...relatedCallIds],
    owner: owner
      ? {
          id: owner.id || null,
          userId: owner.userId || null,
          firstName: owner.firstName || null,
          lastName: owner.lastName || null,
          email: owner.email || null,
          jobTitle: ownerUserProps.hs_job_title || null,
          cargo: ownerUserProps.hs_job_title || null,
          totalLlamadas:
            callsByOwner.get(String(owner.id))?.length || 0
        }
      : null,
    contacts,
    lineItems
  };
});

// Catálogo independiente del periodo: permite mostrar asesores con métricas en cero.
const uniqueOwners = new Map();
for (const owner of ownerMap.values()) {
  if (!owner?.id || owner.archived) continue;
  uniqueOwners.set(String(owner.id), owner);
}

const normalizedOwners = [...uniqueOwners.values()].map(owner => {
  const ownerUser =
    userMap.get(String(owner.email || '').toLowerCase()) ||
    userMap.get(String(owner.userId || '')) ||
    userMap.get(String(owner.id || '')) ||
    null;
  const userProps = ownerUser?.properties || {};

  return {
    ownerId: String(owner.id),
    id: String(owner.id),
    userId: owner.userId ? String(owner.userId) : null,
    firstName: owner.firstName || null,
    lastName: owner.lastName || null,
    nombre: [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim(),
    email: owner.email || null,
    jobTitle: userProps.hs_job_title || null,
    cargo: userProps.hs_job_title || null
  };
});

  const embudo = await embudoPromise;

  return {
    periodo,
    desdeISO: start.toISOString(),
    hastaISO: end.toISOString(),
    totalDeals: result.length,
    totalLineItems: lineItemIds.length,
    totalCalls: normalizedCalls.length,
    elapsedMs: Date.now() - startedAt,
    embudo,
    deals: result,
    calls: normalizedCalls,
    owners: normalizedOwners
  };
}

// Determina si un deal está cerrado-ganado (mismo criterio que el frontend).
function isClosedWon(dealStageId, stageLabelMap) {
  const stage = String(dealStageId || '').toLowerCase();
  const label = String(stageLabelMap.get(String(dealStageId)) || '').toLowerCase();
  return (
    stage === 'closedwon' ||
    stage === '1338692463' ||
    stage.includes('won') ||
    label.includes('exitoso') ||
    label.includes('ganado')
  );
}

function isClosedLost(dealStageId, stageLabelMap) {
  const stage = String(dealStageId || '').toLowerCase();
  const label = String(stageLabelMap.get(String(dealStageId)) || '').toLowerCase();
  return (
    stage === 'closedlost' ||
    stage.includes('lost') ||
    label.includes('perdido')
  );
}

// Clasifica la etapa de un negocio en la columna del embudo que muestra el dashboard.
// "No contactado" / "Contactado" / "Perdido" no clasifican en ninguna columna del
// embudo, pero sí cuentan para cantidadTotal/cantidadPonderada — igual que el tablero
// de HubSpot, cuyo total incluye todas las etapas.
function classifyEmbudoStage(stageLabel) {
  const label = String(stageLabel || '').toLowerCase();
  if (label.includes('interes')) return 'interesado';
  if (label.includes('promesa')) return 'promesa';
  if (label.includes('exitoso') || label.includes('ganado') || label.includes('won')) return 'cerrado';
  return null;
}

const EMBUDO_TTL_MS = 5 * 60_000; // snapshot del pipeline, un cache por periodo (día/mes)

// Replica el tile "Cantidad de nuevo negocio" del tablero de HubSpot: a diferencia
// del resto del dashboard, ESE tile no filtra por pipeline (suma Equipo Comercial +
// Ventas Consultoría + Asesorías/conversión) y trata un negocio SIN "Tipo de negocio"
// asignado como si fuera "Cliente nuevo" -- confirmado comparando manualmente los
// negocios creados en el periodo, agrupados por pipeline y dealtype, contra el número
// que muestra HubSpot. Consulta aparte y liviana (solo amount + dealtype), sin la
// exclusión de EXCLUDED_PIPELINE_IDS que sí aplica searchDeals().
async function fetchCantidadNuevoNegocio(desde, hasta) {
  let total = 0;
  let after = null;
  let page = 0;

  do {
    const body = {
      filterGroups: [{
        filters: [
          { propertyName: 'createdate', operator: 'GTE', value: String(desde.getTime()) },
          { propertyName: 'createdate', operator: 'LTE', value: String(hasta.getTime()) }
        ]
      }],
      properties: ['amount', 'dealtype'],
      limit: 100
    };

    if (after) body.after = after;

    const data = await hubspotFetch('/crm/v3/objects/deals/search', {
      method: 'POST',
      body
    });

    for (const deal of data.results || []) {
      const dealtype = String(deal.properties?.dealtype || '').toLowerCase();
      if (dealtype === 'newbusiness' || dealtype === '') {
        total += Number(deal.properties?.amount || 0);
      }
    }

    after = data.paging?.next?.after || null;
    page += 1;
  } while (after && page < DEALS_PAGE_CAP);

  return total;
}

// Snapshot del pipeline (SIN filtrar por closedate, igual que el tablero de HubSpot
// filtrado a "Fecha de creación: Hoy"/"Este mes"): cantidad total/ponderada de negocio
// + conteo de negocios por etapa y por asesor, ACOTADO al mismo periodo que pidió el
// dashboard (hoy para "diario", el mes para "mensual") -- así "Datos del Día" cuadra
// con el tablero de HubSpot filtrado a Hoy, y no con todo el mes.
//
// "allDeals" ya viene de searchDeals() (closedate O createdate en el periodo) -- no
// hace un fetch propio a HubSpot, solo filtra en memoria a los que tienen createdate
// en el periodo (puede ser un subconjunto de allDeals, ya que ese arreglo también
// incluye negocios que solo matchean por closedate).
async function getEmbudoSnapshot(periodoParaEmbudo, allDeals) {
  const embudoCacheKey = `embudo:${DATASET_SCHEMA_VERSION}:${periodoParaEmbudo}`;
  const cached = staticData[embudoCacheKey];
  const isFresh = cached && Date.now() - cached.savedAt < EMBUDO_TTL_MS;

  if (isFresh && query.force !== 'true' && !staticData.cacheDirty) {
    return cached.payload;
  }

  const { start: desde, end: hasta } = getPeriodRange(periodoParaEmbudo);
  const deals = allDeals.filter((deal) => {
    const raw = deal.properties?.createdate;
    if (!raw) return false;
    const fecha = new Date(raw);
    return !Number.isNaN(fecha.getTime()) && fecha >= desde && fecha <= hasta;
  });

  const catalogs = await getCatalogs();
  const { ownerMap, stageLabelMap, stageProbabilityMap } = catalogs;

  function ownerInfo(ownerId) {
    const owner = ownerId ? ownerMap.get(ownerId) || null : null;
    const nombre = owner
      ? [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim()
      : 'Sin asesor asignado';
    return { nombre };
  }

  const grouped = new Map();

  function getRow(ownerId, nombre) {
    if (!grouped.has(ownerId)) {
      grouped.set(ownerId, {
        ownerId, nombre,
        interesados: 0, promesas: 0, cerrados: 0,
        cantidadTotal: 0, cantidadPonderada: 0,
        cantidadAbierta: 0, valorCerrado: 0, cantidadNuevoNegocio: 0
      });
    }
    return grouped.get(ownerId);
  }

  // Catálogo independiente de los negocios: permite mostrar asesores en cero.
  const uniqueOwners = new Map();
  for (const owner of ownerMap.values()) {
    if (!owner?.id || owner.archived) continue;
    uniqueOwners.set(String(owner.id), owner);
  }
  for (const owner of uniqueOwners.values()) {
    const { nombre } = ownerInfo(String(owner.id));
    getRow(String(owner.id), nombre);
  }

  let cantidadTotal = 0;
  let cantidadPonderada = 0;
  let cantidadAbierta = 0;
  let valorCerrado = 0;

  for (const deal of deals) {
    const props = deal.properties || {};
    const amount = Number(props.amount || 0);
    const stageId = props.dealstage || null;
    const stageLabel = stageId ? (stageLabelMap.get(String(stageId)) || null) : null;
    const probability = stageId ? (stageProbabilityMap.get(String(stageId)) || 0) : 0;
    const weighted = amount * probability;
    const won = isClosedWon(stageId, stageLabelMap);
    const lost = isClosedLost(stageId, stageLabelMap);
    // Propiedad estándar "Tipo de negocio" de HubSpot (New Business / Existing
    // Business); solo alimenta el desglose por asesor (row.cantidadNuevoNegocio) --
    // el total de arriba (cantidadNuevoNegocio) sale de fetchCantidadNuevoNegocio(),
    // ver el comentario ahí.
    const esNuevoNegocio = String(props.dealtype || '').toLowerCase() === 'newbusiness';

    cantidadTotal += amount;
    cantidadPonderada += weighted;
    if (!won && !lost) cantidadAbierta += amount;
    if (won) valorCerrado += amount;

    const ownerId = props.hubspot_owner_id ? String(props.hubspot_owner_id) : 'sin-owner';
    const { nombre } = ownerInfo(ownerId === 'sin-owner' ? null : ownerId);
    const row = getRow(ownerId, nombre);

    row.cantidadTotal += amount;
    row.cantidadPonderada += weighted;
    if (!won && !lost) row.cantidadAbierta += amount;
    if (won) row.valorCerrado += amount;
    if (esNuevoNegocio) row.cantidadNuevoNegocio += amount;

    const stage = classifyEmbudoStage(stageLabel);
    if (stage === 'interesado') row.interesados += 1;
    else if (stage === 'promesa') row.promesas += 1;
    else if (stage === 'cerrado') row.cerrados += 1;
  }

  // El tile "Cantidad de nuevo negocio" del tablero de HubSpot NO respeta el filtro de
  // pipeline "Equipo Comercial" (a diferencia de los demás KPIs) y además cuenta los
  // negocios SIN "Tipo de negocio" asignado como "Cliente nuevo" -- confirmado
  // comparando manualmente contra HubSpot. Por eso NO se puede calcular a partir de
  // "deals" (que sí excluye Ventas Consultoría/Asesorías-conversión, ver
  // EXCLUDED_PIPELINE_IDS): se pide aparte, sin filtro de pipeline.
  const cantidadNuevoNegocio = await fetchCantidadNuevoNegocio(desde, hasta);

  // OJO: estos totales son de TODA la cuenta (incluye Consultores, no solo la lista
  // cerrada de 7 Asesores del dashboard) -- el frontend (useData.ts) recalcula estos
  // mismos totales pero sumando solo las filas de "porAsesor" que matchean
  // ADVISOR_ROSTER, para que cuadren con el tablero "Equipo Comercial" de HubSpot.
  const payload = {
    totalNegocios: deals.length,
    cantidadTotal,
    cantidadPonderada,
    cantidadAbierta,
    valorCerrado,
    cantidadNuevoNegocio,
    porAsesor: [...grouped.values()]
  };

  staticData[embudoCacheKey] = { savedAt: Date.now(), payload };

  return payload;
}

// Construye el dataset "agregado": Año y Mes-pasado solo alimentan totales
// por asesor (ranking de ventas), así que evita por completo leer calls,
// contactos y line items — son rangos de fecha más anchos (un trimestre, un
// mes completo, un año) y esas asociaciones por-deal son lo que hacía que el
// webhook tardara demasiado o se quedara sin responder.
async function buildAggregatePayload() {
  const startedAt = Date.now();

  const [deals, catalogs] = await Promise.all([
    searchDeals(),
    getCatalogs()
  ]);
  const { ownerMap, userMap, stageLabelMap } = catalogs;

  const wonDeals = deals.filter(deal => isClosedWon(deal.properties?.dealstage, stageLabelMap));

  function ownerInfo(ownerId) {
    const owner = ownerId ? ownerMap.get(ownerId) || null : null;
    const ownerUser = owner
      ? userMap.get(String(owner.email || '').toLowerCase()) ||
        userMap.get(String(owner.userId || '')) ||
        userMap.get(String(owner.id || '')) ||
        null
      : null;
    const cargo = ownerUser?.properties?.hs_job_title || null;
    const nombre = owner
      ? [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim()
      : 'Sin asesor asignado';
    return { nombre, cargo };
  }

  const grouped = new Map();
  for (const deal of wonDeals) {
    const props = deal.properties || {};
    const ownerId = props.hubspot_owner_id ? String(props.hubspot_owner_id) : 'sin-owner';

    if (!grouped.has(ownerId)) {
      const { nombre, cargo } = ownerInfo(ownerId === 'sin-owner' ? null : ownerId);
      grouped.set(ownerId, {
        ownerId, nombre, cargo,
        totalVentas: 0, numeroDeals: 0, totalLlamadas: 0, deals: []
      });
    }

    const row = grouped.get(ownerId);
    row.totalVentas += Number(props.amount || 0);
    row.numeroDeals += 1;
  }

  // Catálogo independiente del periodo: permite mostrar asesores con ventas en cero.
  const uniqueOwners = new Map();
  for (const owner of ownerMap.values()) {
    if (!owner?.id || owner.archived) continue;
    uniqueOwners.set(String(owner.id), owner);
  }

  const normalizedOwners = [...uniqueOwners.values()].map(owner => {
    const { nombre, cargo } = ownerInfo(String(owner.id));
    return {
      ownerId: String(owner.id),
      id: String(owner.id),
      userId: owner.userId ? String(owner.userId) : null,
      firstName: owner.firstName || null,
      lastName: owner.lastName || null,
      nombre,
      email: owner.email || null,
      jobTitle: cargo,
      cargo
    };
  });

  for (const owner of normalizedOwners) {
    if (!grouped.has(owner.ownerId)) {
      grouped.set(owner.ownerId, {
        ownerId: owner.ownerId, nombre: owner.nombre, cargo: owner.cargo,
        totalVentas: 0, numeroDeals: 0, totalLlamadas: 0, deals: []
      });
    }
  }

  const ranking = [...grouped.values()]
    .sort((a, b) => b.totalVentas - a.totalVentas || b.numeroDeals - a.numeroDeals)
    .map((row, index) => ({ ...row, posicion: index + 1 }));

  // Lista cruda liviana (sin contactos/line items/llamadas) para poder
  // revisar duplicados o negocios de prueba desde fuera sin pagar el costo
  // de la ruta detallada. Incluye TODOS los deals del rango (no solo
  // closedwon) para poder ver si hay negocios mal etiquetados.
  const dealsResumen = deals.map(deal => {
    const props = deal.properties || {};
    const ownerId = props.hubspot_owner_id ? String(props.hubspot_owner_id) : null;
    const { nombre } = ownerInfo(ownerId);
    return {
      dealId: deal.id,
      dealName: props.dealname || null,
      amount: Number(props.amount || 0),
      dealStage: props.dealstage || null,
      dealStageLabel: props.dealstage ? (stageLabelMap.get(String(props.dealstage)) || null) : null,
      esGanado: isClosedWon(props.dealstage, stageLabelMap),
      ownerId,
      ownerNombre: nombre,
      closeDate: props.closedate || null,
      createDate: props.createdate || null,
    };
  });

  return {
    periodo,
    desdeISO: start.toISOString(),
    hastaISO: end.toISOString(),
    totalDeals: wonDeals.length,
    totalLineItems: 0,
    totalCalls: 0,
    elapsedMs: Date.now() - startedAt,
    ranking,
    owners: normalizedOwners,
    dealsResumen
  };
}

const LEAN_PERIODS = new Set(['anual', 'trimestral', 'mes_pasado', 'mes_anterior']);
const payload = LEAN_PERIODS.has(periodo)
  ? await buildAggregatePayload()
  : await buildDetailedPayload();

staticData[cacheKey] = {
  savedAt: Date.now(),
  payload
};

staticData.cacheDirty = false;

staticData.lastBuild = {
  at: new Date().toISOString(),
  periodo,
  totalDeals: payload.totalDeals,
  totalLineItems: payload.totalLineItems,
  totalCalls: payload.totalCalls
};

return [{
  json: {
    ...payload,
    datasetSchemaVersion: DATASET_SCHEMA_VERSION,
    cache: {
      hit: false,
      savedAt: staticData[cacheKey].savedAt,
      ageMs: 0,
      dirty: false
    }
  }
}];
