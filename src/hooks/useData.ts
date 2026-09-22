import { useQuery } from '@tanstack/react-query';

const DEFAULT_N8N_BASE = 'https://diaz-lara.app.n8n.cloud/webhook';
const env = (import.meta as any).env;

const DATASET_URL =
  env.VITE_WEBHOOK_DATASET ||
  env.VITE_WEBHOOK_RANKING ||
  `${env.VITE_N8N_BASE_URL || DEFAULT_N8N_BASE}/ranking-asesores`;

const API_KEY = env.VITE_API_KEY;
const REFRESH_INTERVAL = Number(env.VITE_REFRESH_INTERVAL || 60_000);

// Lista cerrada de asesores que se muestran en el ranking, con su meta
// mensual individual. Cualquier owner de HubSpot que no esté en esta lista
// se descarta (ver getAdvisorRoster / mergeRankingWithRoster) — el ranking
// ya no se "descubre" dinámicamente desde el catálogo de owners.
const ADVISOR_ROSTER = [
  { nombre: 'Mónica Velázquez', cargo: 'Asesor', metaMensual: 1_000_000 },
  { nombre: 'Yuliana Rivera Fararoni', cargo: 'Asesor', metaMensual: 800_000 },
  { nombre: 'Andrea Valdez', cargo: 'Asesor', metaMensual: 300_000 },
  { nombre: 'Andrea Paredes', cargo: 'Asesor', metaMensual: 300_000 },
  { nombre: 'Jesús Maltos', cargo: 'Asesor', metaMensual: 200_000 },
  { nombre: 'Omar Díaz', cargo: 'Asesor', metaMensual: 150_000 },
  { nombre: 'Jose Francisco Zepeda Gallegos', cargo: 'Asesor', metaMensual: 100_000 },
];

export const isMockMode = false;

type HubspotOwner = {
  id?: string | null;
  userId?: string | number | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  jobTitle?: string | null;
  cargo?: string | null;
};

type HubspotContact = {
  id?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  estadoLead?: string | null;
  totalLlamadas?: string | number | null;
  numeroLlamadas?: string | number | null;
  calls?: string | number | any[] | null;
};

type HubspotLineItem = {
  id?: string | null;
  name?: string | null;
  nombre?: string | null;
  quantity?: string | number | null;
  cantidad?: string | number | null;
  price?: string | number | null;
  precio?: string | number | null;
  amount?: string | number | null;
  monto?: string | number | null;
  hs_product_id?: string | null;
  productId?: string | null;
  sku?: string | null;
  properties?: Record<string, any>;
};

type HubspotDeal = {
  dealId?: string | null;
  dealName?: string | null;
  amount?: string | number | null;
  dealStage?: string | null;
  pipeline?: string | null;
  closeDate?: string | null;
  createDate?: string | null;
  lastModifiedDate?: string | null;
  hubspotOwnerId?: string | null;
  owner?: HubspotOwner | null;
  contacts?: HubspotContact[];
  lineItems?: HubspotLineItem[];
  totalLlamadas?: string | number | null;
  numeroLlamadas?: string | number | null;
  llamadas?: string | number | any[] | null;
  calls?: string | number | any[] | null;
};

type HubspotCall = {
  id?: string | null;
  ownerId?: string | null;
  timestamp?: string | null;
  status?: string | null;
  duration?: string | number | null;
  contactIds?: Array<string | number>;
  dealIds?: Array<string | number>;
};

function toArrayPayload(data: any): HubspotDeal[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.deals)) return data.deals;
  if (Array.isArray(data?.data)) return data.data;
  if (data?.dealId || data?.dealName) return [data];
  return [];
}

function toCallsPayload(data: any): HubspotCall[] {
  if (Array.isArray(data?.calls)) return data.calls;
  if (Array.isArray(data?.llamadas)) return data.llamadas;
  return [];
}

function toNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function getCallCount(source: any) {
  const value =
    source?.totalLlamadas ??
    source?.numeroLlamadas ??
    source?.llamadasRegistradas ??
    source?.callCount ??
    source?.callsCount ??
    source?.llamadas ??
    source?.calls ??
    0;

  return Array.isArray(value) ? value.length : toNumber(value);
}

function fullName(first?: string | null, last?: string | null) {
  return [first, last].filter(Boolean).join(' ').trim();
}

function normalizeName(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getAdvisorRoster(data: any) {
  const payloadOwners = Array.isArray(data?.owners) ? data.owners : [];
  const byName = new Map<string, any>();

  ADVISOR_ROSTER.forEach((advisor, index) => {
    byName.set(normalizeName(advisor.nombre), {
      ownerId: `advisor-${index + 1}`,
      ...advisor,
      rosterIndex: index,
    });
  });

  // Solo se completa el ownerId/cargo real de HubSpot para asesores que YA
  // están en ADVISOR_ROSTER (por nombre). Un owner de HubSpot que no esté en
  // la lista cerrada nunca se agrega — así el ranking queda limitado
  // exactamente a estos asesores, sin importar qué traiga el webhook.
  payloadOwners.forEach((owner: any) => {
    const nombre = owner.nombre || owner.name || fullName(owner.firstName, owner.lastName);
    const key = normalizeName(nombre);
    const known = key ? byName.get(key) : null;
    if (!known) return;

    const cargo = owner.cargo || owner.jobTitle || '';
    byName.set(key, {
      ...known,
      ownerId: String(owner.ownerId || owner.id || owner.userId || known.ownerId),
      cargo: known.cargo || cargo,
    });
  });

  return Array.from(byName.values()).sort((a, b) => a.rosterIndex - b.rosterIndex);
}

function mergeRankingWithRoster(ranking: any[], data: any, periodo: string) {
  const rowsByName = new Map(
    ranking.map((row) => [normalizeName(row.nombre || row.asesor), row])
  );

  // Lista cerrada: cualquier fila del webhook que no pertenezca a un asesor
  // de ADVISOR_ROSTER (p.ej. "Sin asesor asignado" o alguien fuera de la
  // lista) se descarta en vez de agregarse al final.
  const merged = getAdvisorRoster(data).map((advisor) => {
    const row = rowsByName.get(normalizeName(advisor.nombre));
    if (row) {
      return { ...advisor, ...row, cargo: row.cargo || advisor.cargo, metaMensual: advisor.metaMensual };
    }

    return {
      ...advisor,
      totalVentas: 0,
      monto: 0,
      numeroDeals: 0,
      totalLlamadas: 0,
      deals: [],
    };
  });

  return merged
    .sort((a, b) =>
      toNumber(b.totalVentas) - toNumber(a.totalVentas) ||
      toNumber(b.numeroDeals) - toNumber(a.numeroDeals) ||
      toNumber(a.rosterIndex) - toNumber(b.rosterIndex)
    )
    .map((row, index) => withMeta({
      ...row,
      posicion: index + 1,
      totalVentas: toNumber(row.totalVentas ?? row.monto),
      monto: toNumber(row.monto ?? row.totalVentas),
      numeroDeals: toNumber(row.numeroDeals ?? row.deals),
      totalLlamadas: getCallCount(row),
      deals: Array.isArray(row.deals) ? row.deals : [],
    }, periodo));
}

// El snapshot de embudo que arma n8n (getEmbudoSnapshot en Construir Dataset
// Optimizado.js) suma TODA la cuenta de HubSpot, incluyendo owners que no son parte
// de ADVISOR_ROSTER (p.ej. el equipo de Consultores) \u2014 por eso no cuadra 1:1 con el
// tablero de HubSpot filtrado a "Equipo Comercial". Ac\u00e1 se recalculan esos mismos
// totales pero sumando solo las filas de porAsesor que s\u00ed pertenecen a la lista
// cerrada de asesores (mismo criterio de "lista cerrada" que el resto del archivo).
function scopeEmbudoToRoster(embudo: any, ranking: any[]) {
  if (!embudo) return embudo;

  const rosterKeys = new Set<string>();
  for (const row of ranking) {
    if (row.ownerId) rosterKeys.add(String(row.ownerId));
    rosterKeys.add(normalizeName(row.nombre));
  }

  const rows = (embudo.porAsesor || []).filter(
    (row: any) => rosterKeys.has(String(row.ownerId)) || rosterKeys.has(normalizeName(row.nombre))
  );
  const sum = (key: string) => rows.reduce((s: number, r: any) => s + toNumber(r[key]), 0);

  return {
    ...embudo,
    cantidadTotal: sum('cantidadTotal'),
    cantidadPonderada: sum('cantidadPonderada'),
    cantidadAbierta: sum('cantidadAbierta'),
    valorCerrado: sum('valorCerrado'),
    // OJO: cantidadNuevoNegocio NO se recalcula aquí -- a diferencia de los demás
    // campos, n8n ya lo trae correcto de fetchCantidadNuevoNegocio() (ver Construir
    // Dataset Optimizado.js), que replica el tile de HubSpot: TODAS las pipelines
    // (no solo Equipo Comercial) + negocios sin "Tipo de negocio" asignado. Sumar
    // porAsesor[].cantidadNuevoNegocio aquí lo pisaría con el valor viejo, acotado
    // solo a Equipo Comercial con dealtype='newbusiness' explícito.
  };
}

// Cada asesor de ADVISOR_ROSTER trae su propia metaMensual expl\u00edcita; esto
// solo cubre el caso defensivo de una fila sin meta asignada.
function getMetaMensual(_cargo?: string | null) {
  return 0;
}

function getMetaFactor(periodo?: string | null) {
  // La meta diaria es la meta mensual repartida entre 30 días.
  if (periodo === 'diario') return 1 / 30;
  if (periodo === 'trimestral') return 3;
  if (periodo === 'anual') return 12;
  return 1;
}

function withMeta(row: any, periodo = 'mensual') {
  const cargo = row.cargo || row.jobTitle || '';
  const metaMensual = toNumber(row.metaMensual) || getMetaMensual(cargo);
  const metaPeriodo = toNumber(row.metaPeriodo) || metaMensual * getMetaFactor(periodo);
  const totalVentas = toNumber(row.totalVentas ?? row.monto);

  return {
    ...row,
    cargo,
    metaMensual,
    metaPeriodo,
    avanceMetaPct: metaPeriodo ? Math.round((totalVentas / metaPeriodo) * 100) : 0,
  };
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getPeriodRange(periodo: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, Number(value)]));
  const year = values.year;
  const monthIndex = values.month - 1;
  const day = values.day;
  const mexicoStart = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d, 6, 0, 0, 0));
  const mexicoEnd = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d + 1, 5, 59, 59, 999));

  let start = mexicoStart(year, monthIndex, day);
  let end = mexicoEnd(year, monthIndex, day);

  if (periodo === 'diario') return { start, end };

  if (periodo === 'mes_pasado' || periodo === 'mes_anterior') {
    start = mexicoStart(year, monthIndex - 1, 1);
    end = new Date(mexicoStart(year, monthIndex, 1).getTime() - 1);
    return { start, end };
  }

  if (periodo === 'trimestral') {
    const quarterStartMonth = Math.floor(monthIndex / 3) * 3;
    start = mexicoStart(year, quarterStartMonth, 1);
    return { start, end };
  }

  if (periodo === 'anual') {
    start = mexicoStart(year, 0, 1);
    return { start, end };
  }

  start = mexicoStart(year, monthIndex, 1);
  return { start, end };
}

// Un negocio "está en el periodo" (para leads/contactos, ver useLeadsContactados) si
// CERRÓ en el periodo O se CREÓ en el periodo -- no solo una u otra, para no perder de
// vista un negocio recién creado que aún no cierra. El webhook de n8n (searchDeals) ya
// trae los deals con este mismo criterio OR, este filtro es un respaldo client-side con
// la misma lógica.
function filterDealsByPeriod(deals: HubspotDeal[], periodo: string) {
  const { start, end } = getPeriodRange(periodo);
  const inRange = (value?: string | null) => {
    const date = parseDate(value);
    return Boolean(date && date >= start && date <= end);
  };
  return deals.filter((deal) => inRange(deal.closeDate) || inRange(deal.createDate));
}

// "Ventas Totales" (ranking de asesores, ranking de producto) cuenta un negocio
// ganado SOLO si su createdate cae en el periodo -- el tablero de HubSpot que se usa
// para comparar SIEMPRE está filtrado por "Fecha de creación" (nunca por fecha de
// cierre), así que este es el criterio que cuadra 1:1 con ese número. Es el mismo
// criterio que ya usa embudo.valorCerrado en n8n (ver getEmbudoSnapshot en Construir
// Dataset Optimizado.js) -- aquí se recalcula del lado del cliente para que la fila
// de cada asesor en la tabla sume exacto al KPI de arriba.
function filterClosedDealsByPeriod(deals: HubspotDeal[], periodo: string) {
  const { start, end } = getPeriodRange(periodo);
  const inRange = (value?: string | null) => {
    const date = parseDate(value);
    return Boolean(date && date >= start && date <= end);
  };
  return deals.filter((deal) => inRange(deal.createDate));
}

function isClosedWon(deal: HubspotDeal) {
  const stage = String(deal.dealStage || '').toLowerCase();
  const label = String((deal as any).dealStageLabel || '').toLowerCase();
  return (
    stage === 'closedwon' ||
    stage === '1338692463' ||
    stage.includes('won') ||
    stage.includes('ganado') ||
    label.includes('exitoso') ||
    label.includes('ganado')
  );
}

function getLineItems(deal: HubspotDeal) {
  return Array.isArray(deal.lineItems) ? deal.lineItems.filter(Boolean) : [];
}

function getLineItemName(item: HubspotLineItem) {
  const value =
    item.name ||
    item.nombre ||
    item.properties?.name ||
    item.properties?.hs_sku ||
    item.sku ||
    item.properties?.hs_product_id ||
    item.hs_product_id ||
    item.productId ||
    '';

  return String(value).trim();
}

function getLineItemUnits(item: HubspotLineItem) {
  return toNumber(item.quantity ?? item.cantidad ?? item.properties?.quantity) || 1;
}

function getLineItemTotal(item: HubspotLineItem) {
  const units = getLineItemUnits(item);
  return (
    toNumber(item.amount ?? item.monto ?? item.properties?.amount) ||
    toNumber(item.price ?? item.precio ?? item.properties?.price) * units
  );
}

const FETCH_TIMEOUT_MS = 20_000;

async function fetchDataset(periodo = 'mensual', force = false) {
  const url = new URL(DATASET_URL);
  // El webhook de n8n soporta "mes_pasado" nativamente (ver "Construir Dataset
  // Optimizado.js"): calcula el rango del mes anterior y, para periodos
  // agregados (mes_pasado/trimestral/anual), solo trae totales por asesor —
  // ya no hace falta pedir "trimestral" como aproximación.
  url.searchParams.set('periodo', periodo);
  if (force) url.searchParams.set('force', 'true');

  // Algunos periodos hacen que el webhook de n8n responda 200 sin cerrar el
  // body (queda "colgado" leyendo el stream para siempre). Sin timeout,
  // fetch(...).json() nunca resuelve ni rechaza. AbortController fuerza el
  // corte para que react-query pueda reintentar o mostrar el error.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url.toString(), {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Tiempo de espera agotado al cargar datos desde n8n (periodo=${periodo})`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) throw new Error(`Error ${res.status} al cargar datos desde n8n`);

  const bodyTimeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let data;
  try {
    data = await res.json();
  } catch (err: any) {
    if (err?.name === 'AbortError' || controller.signal.aborted) {
      throw new Error(`Tiempo de espera agotado al leer datos desde n8n (periodo=${periodo})`);
    }
    throw err;
  } finally {
    clearTimeout(bodyTimeout);
  }

  if (data?.message === 'Workflow was started') {
    throw new Error(
      'n8n inicio el workflow, pero el webhook no devolvio el JSON final. Cambia el Webhook a responder con el ultimo nodo o agrega un nodo Respond to Webhook al final.'
    );
  }

  return data;
}

function useDealsDataset(periodo = 'mensual', interval = REFRESH_INTERVAL) {
  return useQuery({
    queryKey: ['hubspot-deals-dataset', DATASET_URL, periodo],
    queryFn: () => fetchDataset(periodo),
    refetchInterval: interval,
    staleTime: Math.max(0, interval - 5_000),
    retry: 2,
    select: toArrayPayload,
  });
}

export async function refreshDatasetNow(periodo = 'mensual') {
  return fetchDataset(periodo, true);
}

export function useRankingAsesores(periodo = 'mensual', interval = REFRESH_INTERVAL) {
  return useQuery({
    queryKey: ['hubspot-deals-dataset', DATASET_URL, periodo],
    queryFn: () => fetchDataset(periodo),
    refetchInterval: interval,
    staleTime: Math.max(0, interval - 5_000),
    retry: 2,
    select: (data) => {
      if (Array.isArray(data?.ranking)) {
        const normalizedRanking = data.ranking.map((row: any, index: number) => withMeta({
          ...row,
          ownerId: row.ownerId || row.id || String(index + 1),
          nombre: row.nombre || row.asesor || 'Sin asesor asignado',
          cargo: row.cargo || row.jobTitle || '',
          totalVentas: toNumber(row.totalVentas ?? row.monto),
          monto: toNumber(row.monto ?? row.totalVentas),
          numeroDeals: toNumber(row.numeroDeals ?? row.deals),
          totalLlamadas: getCallCount(row),
          deals: Array.isArray(row.deals) ? row.deals : [],
          posicion: row.posicion || row.rank || index + 1,
        }, periodo));
        return {
          ...data,
          ranking: mergeRankingWithRoster(normalizedRanking, data, periodo),
        };
      }

      const deals = filterClosedDealsByPeriod(toArrayPayload(data), periodo).filter(isClosedWon);
      const calls = toCallsPayload(data);
      const grouped = new Map<string, any>();

      for (const advisor of getAdvisorRoster(data)) {
        grouped.set(String(advisor.ownerId), {
          ...advisor,
          totalVentas: 0,
          monto: 0,
          numeroDeals: 0,
          deals: 0,
          dealsDetalle: [],
          totalLlamadas: 0,
        });
      }

      for (const deal of deals) {
        const nombre =
          fullName(deal.owner?.firstName, deal.owner?.lastName) ||
          deal.owner?.email ||
          'Sin asesor asignado';

        // Lista cerrada: un deal de un asesor fuera de ADVISOR_ROSTER no
        // suma al ranking (ni crea una fila nueva).
        const rosterMatch = Array.from(grouped.values()).find(
          (row) => normalizeName(row.nombre) === normalizeName(nombre)
        );
        if (!rosterMatch) continue;

        const row = grouped.get(String(rosterMatch.ownerId));
        const monto = toNumber(deal.amount);
        row.totalVentas += monto;
        row.monto += monto;
        row.numeroDeals += 1;
        if (!calls.length) row.totalLlamadas += getCallCount(deal);
        row.deals += 1;
        row.dealsDetalle.push({
          id: deal.dealId,
          nombre: deal.dealName || 'Sin nombre',
          monto,
          closedate: deal.closeDate,
        });
      }

      for (const call of calls) {
        const ownerId = String(call.ownerId || '');
        const row = grouped.get(ownerId);
        if (row) row.totalLlamadas += 1;
      }

      const ranking = Array.from(grouped.values())
        .sort((a, b) => b.totalVentas - a.totalVentas || b.numeroDeals - a.numeroDeals || toNumber(a.rosterIndex) - toNumber(b.rosterIndex))
        .map((row, index) => withMeta({
          ...row,
          posicion: index + 1,
          deals: row.dealsDetalle,
        }, periodo));

      const { start, end } = getPeriodRange(periodo);
      return {
        ranking,
        periodo,
        desdeISO: start.toISOString(),
        hastaISO: end.toISOString(),
        totalDeals: deals.length,
        // Snapshot del pipeline completo (cantidad total/ponderada + conteo por etapa),
        // lo arma "Construir Dataset Optimizado.js" en n8n — ver getEmbudoSnapshot().
        // Acotado a la lista cerrada de asesores (scopeEmbudoToRoster), para que cuadre
        // con el tablero de HubSpot filtrado a "Equipo Comercial".
        embudo: scopeEmbudoToRoster(data?.embudo || null, ranking),
      };
    },
  });
}

export function useLeadsContactados(periodo = 'mensual', interval = REFRESH_INTERVAL) {
  return useQuery({
    queryKey: ['hubspot-deals-dataset', DATASET_URL, periodo],
    queryFn: () => fetchDataset(periodo),
    refetchInterval: interval,
    staleTime: Math.max(0, interval - 5_000),
    retry: 2,
    select: (data) => {
      if (Array.isArray(data?.leads)) {
        return {
          ...data,
          leads: data.leads.map((lead: any) => ({
            ...lead,
            totalLlamadas: getCallCount(lead),
          })),
        };
      }
      if (Array.isArray(data?.ranking)) {
        return {
          leads: [],
          periodo,
          desdeISO: data.desdeISO,
          total: 0,
        };
      }

      const deals = filterDealsByPeriod(toArrayPayload(data), periodo);
      const calls = toCallsPayload(data);
      const leads = deals.flatMap((deal) => {
        const asesor =
          fullName(deal.owner?.firstName, deal.owner?.lastName) ||
          deal.owner?.email ||
          'Sin asesor asignado';

        const contacts = deal.contacts?.length
          ? deal.contacts
          : [{ id: deal.dealId, firstname: deal.dealName || 'Sin contacto' }];

        return contacts.map((contact, contactIndex) => {
          const contactId = String(contact.id || '');
          const dealId = String(deal.dealId || '');
          const relatedCalls = calls.filter((call) => {
            const contactMatch = (call.contactIds || []).map(String).includes(contactId);
            const dealMatch = (call.dealIds || []).map(String).includes(dealId);
            return contactMatch || dealMatch;
          });
          const latestCall = relatedCalls
            .map((call) => call.timestamp)
            .filter(Boolean)
            .sort()
            .at(-1);

          return ({
          contactId: contact.id || deal.dealId,
          nombre: fullName(contact.firstname, contact.lastname) || contact.company || deal.dealName || 'Sin nombre',
          email: contact.email || '',
          telefono: contact.phone || '',
          asesorId: String(deal.owner?.id || deal.owner?.userId || deal.hubspotOwnerId || ''),
          asesor,
          dealId: deal.dealId,
          dealNombre: deal.dealName || 'Sin producto',
          monto: toNumber(deal.amount),
          estadoNegocio: deal.dealStage || '',
          estadoNegocioLabel: deal.dealStageLabel || '',
          estadoLead: contact.estadoLead || '',
          ultimaLlamada: latestCall || deal.closeDate || deal.createDate || '',
          totalLlamadas: relatedCalls.length || getCallCount(contact) || (contactIndex === 0 ? getCallCount(deal) : 0),
          callIds: relatedCalls.map((call) => call.id).filter(Boolean),
          });
        });
      });

      const { start } = getPeriodRange(periodo);
      return {
        leads,
        periodo,
        desdeISO: start.toISOString(),
        total: leads.length,
      };
    },
  });
}

export function useRankingProducto(periodo = 'mensual', interval = REFRESH_INTERVAL) {
  return useQuery({
    queryKey: ['hubspot-deals-dataset', DATASET_URL, periodo],
    queryFn: () => fetchDataset(periodo),
    refetchInterval: interval,
    staleTime: Math.max(0, interval - 5_000),
    retry: 2,
    select: (data) => {
      if (Array.isArray(data?.ranking)) {
        const hasProductShape = data.ranking.every((row: any) => row.producto);
        return hasProductShape
          ? data
          : { ranking: [], periodo, desdeISO: data.desdeISO, totalProductos: 0 };
      }

      const deals = filterClosedDealsByPeriod(toArrayPayload(data), periodo).filter(isClosedWon);
      const grouped = new Map<string, any>();
      let totalLineItems = 0;
      let dealsWithLineItems = 0;

      for (const deal of deals) {
        const items = getLineItems(deal);
        if (!items.length) continue;

        dealsWithLineItems += 1;

        for (const item of items) {
          const producto = getLineItemName(item);
          if (!producto) continue;

          const unidades = getLineItemUnits(item);
          const total = getLineItemTotal(item);
          totalLineItems += 1;

          if (!grouped.has(producto)) {
            grouped.set(producto, { producto, totalVentas: 0, unidades: 0 });
          }

          const row = grouped.get(producto);
          row.totalVentas += total;
          row.unidades += unidades;
        }
      }

      const ranking = Array.from(grouped.values()).sort((a, b) => b.totalVentas - a.totalVentas);
      const { start } = getPeriodRange(periodo);
      return {
        ranking,
        periodo,
        desdeISO: start.toISOString(),
        totalProductos: ranking.length,
        totalLineItems,
        dealsWithLineItems,
      };
    },
  });
}

// Respaldo estático (Enero-Julio 2026) por si la hoja en vivo (ver abajo) falla o
// tarda en cargar — así "Ventas por Año" nunca queda en blanco. HubSpot no tiene ese
// histórico (apenas se empezó a usar bien hace ~2 meses). "Andrea Valdez" es
// "Gabriela Valdez" en el reporte (confirmado).
const VENTAS_ANUALES_HASTA_JULIO_2026: Record<string, number> = {
  'Mónica Velázquez': 3_137_599.68,
  'Yuliana Rivera Fararoni': 3_228_362.44,
  'Jose Francisco Zepeda Gallegos': 240_525.89,
  'Omar Díaz': 929_184.86,
  'Andrea Paredes': 639_813.82,
  'Andrea Valdez': 1_335_670.28,
  'Jesús Maltos': 916_083.48,
};

// Suma Enero-Julio 2026 de los asesores del reporte que YA NO están en la
// lista actual de 7 (Megan Solorio, Julian Alvarez, Karina Diaz, Gabriel
// Sotelo, Daniela Mendieta, Mauricio Castillo, Mauricio Moreno): 442,188.75 +
// 239,939.57 + 683,018.30 + 34,173.00 + 940,230.72 + 2,155.00 + 176,465.52.
// Se agrupan aquí para que el total anual cuadre con el reporte completo en
// vez de descartar silenciosamente esas ventas. (Nota: el propio Sheet
// muestra un Total de $12,766,790.79, pero sumando sus 14 filas a mano da
// $12,945,411.31 — la fórmula de esa celda probablemente no incluye las dos
// últimas filas, agregadas después. Usamos la suma real de las filas.)
const OTROS_ASESORES_TOTAL = 2_518_170.86;

// Hoja "Venta-Anual-Ranking" que el equipo mantiene a mano con las ventas de los
// meses YA CERRADOS (ver n8n/venta-anual-sheet-webhook.json). A propósito se lee poco
// seguido — no cambia minuto a minuto — y se cachea 6h del lado de n8n; aquí se
// refresca cada 30 min nada más. El total que se muestra en "Ventas por Año" es esta
// hoja + lo que lleve el mes en curso, tomado en vivo de HubSpot vía
// useRankingAsesores('mensual').
const VENTA_ANUAL_SHEET_URL =
  env.VITE_WEBHOOK_VENTA_ANUAL || `${env.VITE_N8N_BASE_URL || DEFAULT_N8N_BASE}/venta-anual-ranking`;
const VENTA_ANUAL_REFRESH_INTERVAL = 30 * 60_000;

// Nombres que aparecen distinto en la hoja "Venta-Anual-Ranking" vs ADVISOR_ROSTER
// (confirmado consultando la hoja directo vía la API de Sheets).
const VENTA_ANUAL_ALIAS: Record<string, string> = {
  'gabriela valdez': 'Andrea Valdez',
  'yuliana fararoni': 'Yuliana Rivera Fararoni',
  'francisco zepeda': 'Jose Francisco Zepeda Gallegos',
  'andrea pardes': 'Andrea Paredes',
};

type VentaAnualSheetRow = { asesor?: string; total?: number };

async function fetchVentaAnualSheet(): Promise<VentaAnualSheetRow[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(VENTA_ANUAL_SHEET_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Tiempo de espera agotado al cargar la hoja de venta anual');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Separa las filas de la hoja en las que sí pertenecen a un asesor de ADVISOR_ROSTER
// (aplicando el alias de arriba) de las que no — mismo criterio de lista cerrada que
// el resto del dashboard: lo que no matchea se agrupa en "Asesores anteriores".
function ventaAnualBaseFromSheet(rows: VentaAnualSheetRow[]) {
  const rosterNames = new Set(ADVISOR_ROSTER.map((a) => normalizeName(a.nombre)));
  const byName = new Map<string, number>();
  let otrosTotal = 0;

  for (const row of rows) {
    const rawNombre = String(row.asesor || '').trim();
    if (!rawNombre) continue;

    const aliasNombre = VENTA_ANUAL_ALIAS[normalizeName(rawNombre)] || rawNombre;
    const key = normalizeName(aliasNombre);
    const total = toNumber(row.total);

    if (rosterNames.has(key)) {
      byName.set(key, (byName.get(key) || 0) + total);
    } else {
      otrosTotal += total;
    }
  }

  return { byName, otrosTotal };
}

function combineVentasAnuales(
  byName: Map<string, number>,
  otrosTotal: number,
  mesActualByName: Map<string, number>
) {
  const merged = ADVISOR_ROSTER.map((advisor, index) => {
    const base = byName.get(normalizeName(advisor.nombre)) ?? 0;
    const mesActual = mesActualByName.get(normalizeName(advisor.nombre)) ?? 0;
    return {
      ownerId: `advisor-${index + 1}`,
      ...advisor,
      totalVentas: base + mesActual,
      numeroDeals: 0,
      totalLlamadas: 0,
      deals: [],
    };
  });

  const ranked = merged
    .sort((a, b) => b.totalVentas - a.totalVentas)
    .map((row, index) => withMeta({ ...row, posicion: index + 1 }, 'anual'));

  // No compite por posición (no es una persona activa): va al final, sin
  // meta ni avatar de asesor real.
  const otros = withMeta({
    ownerId: 'otros-asesores',
    nombre: 'Asesores anteriores',
    cargo: '',
    metaMensual: 0,
    totalVentas: otrosTotal,
    numeroDeals: 0,
    totalLlamadas: 0,
    deals: [],
    posicion: ranked.length + 1,
  }, 'anual');

  return [...ranked, otros];
}

// "Ventas por Año": hoja de Google Sheets (meses ya cerrados) + lo que lleve el mes en
// curso en HubSpot. Si la hoja aún no cargó o falla, usa el corte estático de arriba
// como respaldo para que la pantalla nunca quede en blanco.
export function useVentasAnualesSheet() {
  const sheetQ = useQuery({
    queryKey: ['venta-anual-sheet', VENTA_ANUAL_SHEET_URL],
    queryFn: fetchVentaAnualSheet,
    refetchInterval: VENTA_ANUAL_REFRESH_INTERVAL,
    staleTime: Math.max(0, VENTA_ANUAL_REFRESH_INTERVAL - 5_000),
    retry: 2,
  });
  const mesQ = useRankingAsesores('mensual', 60 * 60_000);

  const mesActualByName = new Map<string, number>();
  for (const row of mesQ.data?.ranking || []) {
    mesActualByName.set(normalizeName(row.nombre), toNumber(row.totalVentas));
  }

  const sheetRows = Array.isArray(sheetQ.data) ? sheetQ.data : null;
  const { byName, otrosTotal } = sheetRows
    ? ventaAnualBaseFromSheet(sheetRows)
    : {
        byName: new Map(
          Object.entries(VENTAS_ANUALES_HASTA_JULIO_2026).map(([nombre, total]) => [normalizeName(nombre), total])
        ),
        otrosTotal: OTROS_ASESORES_TOTAL,
      };

  return {
    data: { ranking: combineVentasAnuales(byName, otrosTotal, mesActualByName), fuenteHoja: Boolean(sheetRows) },
    isLoading: false,
    isError: false,
    error: null,
  };
}

const EVENTOS_PARTICIPANTES_URL = `${env.VITE_N8N_BASE_URL || DEFAULT_N8N_BASE}/eventos-participantes`;

export function useEventosParticipantes(interval = 5 * 60_000) {
  return useQuery<{ hoja: string; participantes: number }[]>({
    queryKey: ['eventos-participantes'],
    queryFn: async () => {
      // Este flujo lee una hoja de Google Sheets por cada pestaña (evento);
      // igual que con fetchDataset, sin timeout un cuelgue del webhook deja
      // la promesa pendiente para siempre en vez de fallar y reintentar.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(EVENTOS_PARTICIPANTES_URL, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          throw new Error('Tiempo de espera agotado al cargar participantes de eventos');
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    refetchInterval: interval,
    staleTime: Math.max(0, interval - 5_000),
    retry: 2,
  });
}

export type VentasWebTotales = {
  totalHistorico: number;
  totalMesActual: number;
  totalMesAnterior?: number;
  totalHoy?: number;
  ordenesCompletadas: number;
  ordenesMesActual: number;
  ordenesMesAnterior?: number;
  ordenesHoy?: number;
  actualizado?: string;
};

const VENTAS_WEB_URL =
  env.VITE_WEBHOOK_VENTAS_WEB || `${env.VITE_N8N_BASE_URL || DEFAULT_N8N_BASE}/ventas-web-diegodiaz`;

// Total vendido por la web (API de Diego Diaz) — ver n8n/ventas-web-diegodiaz-webhook.json.
// Llamado server-to-server desde n8n (login + /payments/admin/orders), nunca directo
// desde el navegador, para no depender de la allowlist de CORS del backend.
export function useVentasWeb(interval = REFRESH_INTERVAL) {
  return useQuery<VentasWebTotales>({
    queryKey: ['ventas-web-diegodiaz', VENTAS_WEB_URL],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(VENTAS_WEB_URL, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // Defensivo: si el nodo "Respond to Webhook" de n8n queda configurado como
        // "All Incoming Items" en vez de "json", envuelve la respuesta en un arreglo
        // de 1 elemento en vez de mandar el objeto directo.
        return Array.isArray(data) ? data[0] : data;
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          throw new Error('Tiempo de espera agotado al cargar ventas de la web');
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    refetchInterval: interval,
    staleTime: Math.max(0, interval - 5_000),
    // Nunca reintentar: este webhook hace login server-to-server contra
    // DD_Backend, que limita /auth/login a 10 intentos/15min (authLimiter). n8n
    // devuelve 500 al navegador cuando el Code node truena (no el 429 original de
    // DD_Backend, asi que no hay codigo de status confiable para filtrar), y
    // reintentar de inmediato contra un servicio caido por rate-limit rio abajo
    // solo suma mas intentos a esa misma ventana y evita que se libere. El
    // proximo refetchInterval (varios minutos despues) ya es tiempo de sobra
    // para que se recupere solo.
    retry: false,
  });
}

export { useDealsDataset };
