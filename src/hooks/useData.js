import { useQuery } from '@tanstack/react-query'
import { MOCK_RANKING, MOCK_LEADS, MOCK_PRODUCTOS, MOCK_KPIS } from '../utils/mockData'

const INTERVAL = Number(import.meta.env.VITE_REFRESH_INTERVAL) || 60_000
const API_KEY  = import.meta.env.VITE_API_KEY || ''
const USE_MOCK = !import.meta.env.VITE_WEBHOOK_RANKING ||
                  import.meta.env.VITE_WEBHOOK_RANKING.includes('TU-N8N')

async function fetchWebhook(url) {
  const res = await fetch(url, {
    headers: API_KEY ? { 'x-api-key': API_KEY } : {},
  })
  if (!res.ok) throw new Error(`Error ${res.status}`)
  return res.json()
}

export function useRanking() {
  return useQuery({
    queryKey: ['ranking'],
    queryFn: USE_MOCK
      ? () => Promise.resolve(MOCK_RANKING)
      : () => fetchWebhook(import.meta.env.VITE_WEBHOOK_RANKING),
    refetchInterval: INTERVAL,
    staleTime: INTERVAL / 2,
  })
}

export function useLeads() {
  return useQuery({
    queryKey: ['leads'],
    queryFn: USE_MOCK
      ? () => Promise.resolve(MOCK_LEADS)
      : () => fetchWebhook(import.meta.env.VITE_WEBHOOK_LEADS),
    refetchInterval: INTERVAL,
    staleTime: INTERVAL / 2,
  })
}

export function useProducto() {
  return useQuery({
    queryKey: ['producto'],
    queryFn: USE_MOCK
      ? () => Promise.resolve(MOCK_PRODUCTOS)
      : () => fetchWebhook(import.meta.env.VITE_WEBHOOK_PRODUCTO),
    refetchInterval: INTERVAL,
    staleTime: INTERVAL / 2,
  })
}

export function useKpis() {
  return useQuery({
    queryKey: ['kpis'],
    queryFn: USE_MOCK
      ? () => Promise.resolve(MOCK_KPIS)
      : () => fetchWebhook(import.meta.env.VITE_WEBHOOK_RANKING).then(data => ({
          totalLeadsHoy: data.reduce((s, a) => s + (a.leadsContactados || 0), 0),
          negociosMes:   data.reduce((s, a) => s + (a.deals || 0), 0),
          montoMes:      data.reduce((s, a) => s + (a.monto || 0), 0),
          asesorDelDia:  data[0]?.nombre || '—',
          ultimaActualizacion: new Date().toISOString(),
        })),
    refetchInterval: INTERVAL,
    staleTime: INTERVAL / 2,
  })
}

export const isMockMode = USE_MOCK
