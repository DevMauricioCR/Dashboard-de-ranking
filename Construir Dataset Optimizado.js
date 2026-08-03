const BASE_URL = 'https://api.hubapi.com';

// En n8n Cloud crea una Variable llamada HUBSPOT_ACCESS_TOKEN.
// En una instalación propia también puedes usar $env.HUBSPOT_ACCESS_TOKEN.
const token = $vars.HUBSPOT_ACCESS_TOKEN;

if (!token) {
  throw new Error('Falta HUBSPOT_ACCESS_TOKEN en variables de entorno de n8n');
}

const query = $('Webhook1').first().json.query || {};
const periodo = query.periodo || 'mensual';
const staticData = $getWorkflowStaticData('global');
// Evita reutilizar datasets guardados por constructores antiguos sin llamadas.
const DATASET_SCHEMA_VERSION = 'v3-calls-owners';
const cacheKey = `dashboard:${DATASET_SCHEMA_VERSION}:${periodo}`;
const cacheTtlMs = Number(query.cacheTtlMs || 120000);
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

async function searchDeals() {
  const deals = [];
  let after = null;

  do {
    const body = {
      filterGroups: [{
        filters: [
          {
            propertyName: 'closedate',
            operator: 'GTE',
            value: String(start.getTime())
          },
          {
            propertyName: 'closedate',
            operator: 'LTE',
            value: String(end.getTime())
          }
        ]
      }],
      properties: [
        'dealname',
        'amount',
        'dealstage',
        'pipeline',
        'closedate',
        'createdate',
        'hs_lastmodifieddate',
        'hubspot_owner_id'
      ],
      limit: 100,
      sorts: [{
        propertyName: 'closedate',
        direction: 'DESCENDING'
      }]
    };

    if (after) body.after = after;

    const data = await hubspotFetch('/crm/v3/objects/deals/search', {
      method: 'POST',
      body
    });

    deals.push(...(data.results || []));
    after = data.paging?.next?.after || null;
  } while (after);

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

async function getStageLabels() {
  const map = new Map();
  const data = await hubspotFetch('/crm/v3/pipelines/deals');

  for (const pipeline of data.results || []) {
    for (const stage of pipeline.stages || []) {
      if (stage.id) {
        map.set(String(stage.id), stage.label || stage.id);
      }
    }
  }

  return map;
}

async function getOwners() {
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

  const map = new Map();
  for (const owner of owners) {
    if (owner.id) map.set(String(owner.id), owner);
    if (owner.userId) map.set(String(owner.userId), owner);
  }

  return map;
}

async function getUsers() {
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

  const map = new Map();
  for (const user of users) {
    const props = user.properties || {};
    if (user.id) map.set(String(user.id), user);
    if (props.hs_email) {
      map.set(String(props.hs_email).toLowerCase(), user);
    }
  }

  return map;
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

const startedAt = Date.now();

// Deals y llamadas se consultan simultáneamente.
const [deals, calls] = await Promise.all([
  searchDeals(),
  searchCalls()
]);

const dealIds = deals.map(deal => String(deal.id));
const callIds = calls.map(call => String(call.id));

const [
  ownerMap,
  userMap,
  stageLabelMap,
  contactAssociations,
  lineItemAssociations,
  callContactAssociations,
  callDealAssociations
] = await Promise.all([
  getOwners(),
  getUsers(),
  getStageLabels(),
  batchReadAssociations('deals', 'contacts', dealIds),
  batchReadAssociations('deals', 'line_items', dealIds),
  batchReadAssociations('calls', 'contacts', callIds),
  batchReadAssociations('calls', 'deals', callIds)
]);

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
    ['firstname', 'lastname', 'email', 'phone', 'company']
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

const payload = {
  periodo,
  desdeISO: start.toISOString(),
  hastaISO: end.toISOString(),
  totalDeals: result.length,
  totalLineItems: lineItemIds.length,
  totalCalls: normalizedCalls.length,
  elapsedMs: Date.now() - startedAt,
  deals: result,
  calls: normalizedCalls,
  owners: normalizedOwners
};

staticData[cacheKey] = {
  savedAt: Date.now(),
  payload
};

staticData.cacheDirty = false;

staticData.lastBuild = {
  at: new Date().toISOString(),
  periodo,
  totalDeals: result.length,
  totalLineItems: lineItemIds.length,
  totalCalls: normalizedCalls.length
};

return [{
  json: {
    ...payload,
    cache: {
      hit: false,
      savedAt: staticData[cacheKey].savedAt,
      ageMs: 0,
      dirty: false
    }
  }
}];
