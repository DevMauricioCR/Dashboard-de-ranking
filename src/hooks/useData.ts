import { useQuery } from '@tanstack/react-query';

const DEFAULT_N8N_BASE = 'https://diaz-lara.app.n8n.cloud/webhook';
const env = (import.meta as any).env;

const DATASET_URL =
  env.VITE_WEBHOOK_DATASET ||
  env.VITE_WEBHOOK_RANKING ||
  `${env.VITE_N8N_BASE_URL || DEFAULT_N8N_BASE}/ranking-asesores`;

const API_KEY = env.VITE_API_KEY;
const REFRESH_INTERVAL = Number(env.VITE_REFRESH_INTERVAL || 60_000);
const META_ASESOR_JR = 200_000;
const META_ASESOR_SR = 500_000;

const ADVISOR_ROSTER = [
  { nombre: 'Yuliana Rivera Fararoni', cargo: 'Asesor Sr' },
  { nombre: 'Mónica Velázquez', cargo: 'Asesor Sr' },
  { nombre: 'Jesús Maltos', cargo: 'Asesor Sr' },
  { nombre: 'Daniela Mendieta', cargo: 'Asesor Sr' },
  { nombre: 'Omar Díaz', cargo: 'Asesor Sr' },
  { nombre: 'Megan Flores', cargo: 'Asesor Sr' },
  { nombre: 'Andrea Valdez', cargo: 'Asesor Sr' },
  { nombre: 'Jose Francisco Zepeda Gallegos', cargo: 'Asesor Jr' },
  { nombre: 'Gabriel Eduardo Sotelo Fonseca', cargo: 'Asesor Jr' },
  { nombre: 'Andrea Paredes', cargo: 'Asesor Sr' },
  { nombre: 'Karina Díaz', cargo: 'Asesor Sr' },
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

  payloadOwners.forEach((owner: any) => {
    const nombre = owner.nombre || owner.name || fullName(owner.firstName, owner.lastName);
    const key = normalizeName(nombre);
    if (!key) return;

    const cargo = owner.cargo || owner.jobTitle || '';
    const known = byName.get(key);
    const isAdvisor = normalizeName(cargo).includes('asesor') || Boolean(known);
    if (!isAdvisor) return;

    byName.set(key, {
      ownerId: String(owner.ownerId || owner.id || owner.userId || known?.ownerId || key),
      nombre,
      cargo: cargo || known?.cargo || '',
      rosterIndex: known?.rosterIndex ?? byName.size,
    });
  });

  return Array.from(byName.values()).sort((a, b) => a.rosterIndex - b.rosterIndex);
}

function mergeRankingWithRoster(ranking: any[], data: any, periodo: string) {
  const rowsByName = new Map(
    ranking.map((row) => [normalizeName(row.nombre || row.asesor), row])
  );

  const merged = getAdvisorRoster(data).map((advisor) => {
    const row = rowsByName.get(normalizeName(advisor.nombre));
    if (row) {
      rowsByName.delete(normalizeName(advisor.nombre));
      return { ...advisor, ...row, cargo: row.cargo || advisor.cargo };
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

  merged.push(...rowsByName.values());

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

function getMetaMensual(cargo?: string | null) {
  const normalized = String(cargo || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalized.includes('asesor') && normalized.includes('sr')) return META_ASESOR_SR;
  if (normalized.includes('asesor') && normalized.includes('jr')) return META_ASESOR_JR;
  return 0;
}

function getMetaFactor(periodo?: string | null) {
  return periodo === 'trimestral' ? 3 : 1;
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

  start = mexicoStart(year, monthIndex, 1);
  return { start, end };
}

function filterDealsByPeriod(deals: HubspotDeal[], periodo: string) {
  const { start, end } = getPeriodRange(periodo);
  return deals.filter((deal) => {
    const date = parseDate(deal.closeDate || deal.createDate);
    return date && date >= start && date <= end;
  });
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

async function fetchDataset(periodo = 'mensual', force = false) {
  const url = new URL(DATASET_URL);
  const requestPeriod = periodo === 'mes_pasado' || periodo === 'mes_anterior'
    ? 'trimestral'
    : periodo;
  url.searchParams.set('periodo', requestPeriod);
  if (force) url.searchParams.set('force', 'true');

  const res = await fetch(url.toString(), {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
    },
  });

  if (!res.ok) throw new Error(`Error ${res.status} al cargar datos desde n8n`);
  const data = await res.json();

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

      const deals = filterDealsByPeriod(toArrayPayload(data), periodo).filter(isClosedWon);
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
        const ownerId = String(deal.owner?.id || deal.owner?.userId || 'sin-owner');
        const nombre =
          fullName(deal.owner?.firstName, deal.owner?.lastName) ||
          deal.owner?.email ||
          'Sin asesor asignado';

        const rosterMatch = Array.from(grouped.values()).find(
          (row) => normalizeName(row.nombre) === normalizeName(nombre)
        );
        const groupKey = rosterMatch ? String(rosterMatch.ownerId) : ownerId;

        if (!grouped.has(groupKey)) {
          grouped.set(groupKey, {
            ownerId,
            nombre,
            cargo: deal.owner?.jobTitle || deal.owner?.cargo || '',
            totalVentas: 0,
            monto: 0,
            numeroDeals: 0,
            deals: 0,
            dealsDetalle: [],
            totalLlamadas: 0,
          });
        }

        const row = grouped.get(groupKey);
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

      const deals = filterDealsByPeriod(toArrayPayload(data), periodo).filter(isClosedWon);
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

export { useDealsDataset };
