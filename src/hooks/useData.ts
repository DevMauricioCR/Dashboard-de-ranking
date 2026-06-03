import { useQuery } from '@tanstack/react-query';

const DEFAULT_N8N_BASE = 'https://diaz-lara.app.n8n.cloud/webhook';
const env = (import.meta as any).env;

const DATASET_URL =
  env.VITE_WEBHOOK_DATASET ||
  env.VITE_WEBHOOK_RANKING ||
  `${env.VITE_N8N_BASE_URL || DEFAULT_N8N_BASE}/ranking-asesores`;

const API_KEY = env.VITE_API_KEY;
const REFRESH_INTERVAL = Number(env.VITE_REFRESH_INTERVAL || 60_000);

export const isMockMode = false;

type HubspotOwner = {
  id?: string | null;
  userId?: string | number | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

type HubspotContact = {
  id?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
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
};

function toArrayPayload(data: any): HubspotDeal[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.deals)) return data.deals;
  if (Array.isArray(data?.data)) return data.data;
  if (data?.dealId || data?.dealName) return [data];
  return [];
}

function toNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function fullName(first?: string | null, last?: string | null) {
  return [first, last].filter(Boolean).join(' ').trim();
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getPeriodRange(periodo: string) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (periodo === 'diario') return { start, end };

  if (periodo === 'mes_pasado' || periodo === 'mes_anterior') {
    start.setMonth(now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    previousMonthEnd.setHours(23, 59, 59, 999);
    return { start, end: previousMonthEnd };
  }

  if (periodo === 'trimestral') {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    start.setMonth(quarterStartMonth, 1);
    return { start, end };
  }

  start.setDate(1);
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
        return {
          ...data,
          ranking: data.ranking.map((row: any, index: number) => ({
            ...row,
            ownerId: row.ownerId || row.id || String(index + 1),
            nombre: row.nombre || row.asesor || 'Sin asesor asignado',
            totalVentas: toNumber(row.totalVentas ?? row.monto),
            monto: toNumber(row.monto ?? row.totalVentas),
            numeroDeals: toNumber(row.numeroDeals ?? row.deals),
            deals: Array.isArray(row.deals) ? row.deals : [],
            posicion: row.posicion || row.rank || index + 1,
          })),
        };
      }

      const deals = filterDealsByPeriod(toArrayPayload(data), periodo).filter(isClosedWon);
      const grouped = new Map<string, any>();

      for (const deal of deals) {
        const ownerId = String(deal.owner?.id || deal.owner?.userId || 'sin-owner');
        const nombre =
          fullName(deal.owner?.firstName, deal.owner?.lastName) ||
          deal.owner?.email ||
          'Sin asesor asignado';

        if (!grouped.has(ownerId)) {
          grouped.set(ownerId, {
            ownerId,
            nombre,
            totalVentas: 0,
            monto: 0,
            numeroDeals: 0,
            deals: 0,
            dealsDetalle: [],
          });
        }

        const row = grouped.get(ownerId);
        const monto = toNumber(deal.amount);
        row.totalVentas += monto;
        row.monto += monto;
        row.numeroDeals += 1;
        row.deals += 1;
        row.dealsDetalle.push({
          id: deal.dealId,
          nombre: deal.dealName || 'Sin nombre',
          monto,
          closedate: deal.closeDate,
        });
      }

      const ranking = Array.from(grouped.values())
        .sort((a, b) => b.totalVentas - a.totalVentas)
        .map((row, index) => ({
          ...row,
          posicion: index + 1,
          deals: row.dealsDetalle,
        }));

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
      if (Array.isArray(data?.leads)) return data;
      if (Array.isArray(data?.ranking)) {
        return {
          leads: [],
          periodo,
          desdeISO: data.desdeISO,
          total: 0,
        };
      }

      const deals = filterDealsByPeriod(toArrayPayload(data), periodo);
      const leads = deals.flatMap((deal) => {
        const asesor =
          fullName(deal.owner?.firstName, deal.owner?.lastName) ||
          deal.owner?.email ||
          'Sin asesor asignado';

        const contacts = deal.contacts?.length
          ? deal.contacts
          : [{ id: deal.dealId, firstname: deal.dealName || 'Sin contacto' }];

        return contacts.map((contact) => ({
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
          ultimaLlamada: deal.closeDate || deal.createDate || '',
        }));
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
