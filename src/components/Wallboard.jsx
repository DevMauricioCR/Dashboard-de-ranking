import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  CartesianGrid, AreaChart, Area
} from 'recharts'
import { useDealsDataset } from '../hooks/useData'
import styles from './Wallboard.module.css'

const COLORS = ['#4f8ef7', '#34d399', '#e8b84b', '#7c5ce8', '#f87171', '#14b8a6', '#f97316', '#9ca3af']

const PIPELINE_LABELS = {
  default: 'Proceso de Ventas',
  '889232491': 'Ventas Consultoria',
}

const STAGE_LABELS = {
  '1338692463': 'Exitoso',
  appointmentscheduled: 'Cita agendada',
  closedwon: 'Cerrado ganado',
  closedlost: 'Cerrado perdido',
  decisionmakerboughtin: 'Decision',
}

const money = n => new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
}).format(n || 0)

const compactMoney = n => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`
  return `$${Math.round(n || 0)}`
}

const number = n => new Intl.NumberFormat('es-MX').format(n || 0)

function toNumber(value) {
  const n = Number(value || 0)
  return Number.isFinite(n) ? n : 0
}

function dateKey(iso) {
  const date = iso ? new Date(iso) : null
  if (!date || Number.isNaN(date.getTime())) return 'Sin fecha'
  return date.toISOString().slice(0, 10)
}

function monthKey(iso) {
  const date = iso ? new Date(iso) : null
  if (!date || Number.isNaN(date.getTime())) return 'Sin fecha'
  return date.toISOString().slice(0, 7)
}

function currentQuarterRange() {
  const now = new Date()
  const start = new Date(now)
  const end = new Date(now)
  const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3

  start.setMonth(quarterStartMonth, 1)
  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}

function isCurrentQuarterClose(deal, range) {
  const date = deal.closeDate ? new Date(deal.closeDate) : null
  if (!date || Number.isNaN(date.getTime())) return false
  return date >= range.start && date <= range.end
}

function ownerName(deal) {
  return [deal.owner?.firstName, deal.owner?.lastName].filter(Boolean).join(' ').trim()
    || deal.owner?.email
    || 'Sin asesor asignado'
}

function lineItemName(item) {
  return item.name || item.nombre || item.sku || item.hs_product_id || item.productId || 'Sin producto'
}

function lineItemAmount(item) {
  const qty = toNumber(item.quantity ?? item.cantidad) || 1
  return toNumber(item.amount ?? item.monto) || toNumber(item.price ?? item.precio) * qty
}

function isClosedWon(deal) {
  const stage = String(deal.dealStage || '').toLowerCase()
  const label = String(deal.dealStageLabel || STAGE_LABELS[stage] || '').toLowerCase()

  return stage === 'closedwon'
    || stage === '1338692463'
    || stage.includes('won')
    || stage.includes('ganado')
    || label.includes('exitoso')
    || label.includes('ganado')
}

function stageLabel(stage) {
  const key = String(stage || '').toLowerCase()
  if (STAGE_LABELS[key]) return STAGE_LABELS[key]
  if (key === 'closedwon' || key.includes('won') || key.includes('ganado')) return 'Cerrado ganado'
  if (key.includes('lost') || key.includes('perdido')) return 'Cerrado perdido'
  if (key.includes('presentation')) return 'Presentacion agendada'
  if (key.includes('contract')) return 'Contrato'
  if (key.includes('decision')) return 'Decision'
  if (key.includes('qualified')) return 'Calificado'
  if (/^\d+$/.test(key)) return 'Etapa personalizada'
  return stage || 'Sin etapa'
}

function pipelineLabel(pipeline) {
  return PIPELINE_LABELS[String(pipeline || '')] || pipeline || 'Sin pipeline'
}

function stageDisplayName(deal) {
  const label = deal.dealStageLabel || stageLabel(deal.dealStage)
  const pipeline = pipelineLabel(deal.pipeline)
  return deal.pipeline && deal.pipeline !== 'default' ? `${label} (${pipeline})` : label
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipLabel}>{label}</p>
      {payload.map(item => (
        <p key={item.dataKey} style={{ color: item.color }}>
          {item.name}: {item.dataKey?.toLowerCase().includes('ventas') || item.dataKey === 'monto'
            ? money(item.value)
            : number(item.value)}
        </p>
      ))}
    </div>
  )
}

function Panel({ title, meta, children }) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2>{title}</h2>
        {meta && <span>{meta}</span>}
      </div>
      <div className={styles.chartWrap}>{children}</div>
    </section>
  )
}

export default function Wallboard() {
  const { data: deals = [], isLoading, isError, error, dataUpdatedAt } = useDealsDataset('trimestral')

  const metrics = useMemo(() => {
    const quarterRange = currentQuarterRange()
    const quarterDeals = deals.filter(deal => isCurrentQuarterClose(deal, quarterRange))
    const closedDeals = quarterDeals.filter(isClosedWon)

    const byAdvisor = new Map()
    const byProduct = new Map()
    const byDay = new Map()
    const byMonth = new Map()
    const byStage = new Map()

    for (const deal of quarterDeals) {
      const amount = toNumber(deal.amount)
      const stage = stageDisplayName(deal)
      byStage.set(stage, (byStage.get(stage) || 0) + 1)

      if (!isClosedWon(deal)) continue

      const advisor = ownerName(deal)
      const currentAdvisor = byAdvisor.get(advisor) || { asesor: advisor, ventas: 0, negocios: 0 }
      currentAdvisor.ventas += amount
      currentAdvisor.negocios += 1
      byAdvisor.set(advisor, currentAdvisor)

      const day = dateKey(deal.closeDate || deal.createDate)
      const currentDay = byDay.get(day) || { fecha: day.slice(5), ventas: 0, negocios: 0 }
      currentDay.ventas += amount
      currentDay.negocios += 1
      byDay.set(day, currentDay)

      const month = monthKey(deal.closeDate || deal.createDate)
      const currentMonth = byMonth.get(month) || { mes: month, ventas: 0, negocios: 0 }
      currentMonth.ventas += amount
      currentMonth.negocios += 1
      byMonth.set(month, currentMonth)

      for (const item of deal.lineItems || []) {
        const product = lineItemName(item)
        const units = toNumber(item.quantity ?? item.cantidad) || 1
        const total = lineItemAmount(item) || amount
        const currentProduct = byProduct.get(product) || { producto: product, ventas: 0, unidades: 0 }
        currentProduct.ventas += total
        currentProduct.unidades += units
        byProduct.set(product, currentProduct)
      }
    }

    const stageTotal = Array.from(byStage.values()).reduce((sum, value) => sum + value, 0)
    const stageData = Array.from(byStage.entries())
      .map(([etapa, value]) => ({
        etapa: stageLabel(etapa),
        value,
        pct: stageTotal ? Math.round((value / stageTotal) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)

    return {
      totalVentas: closedDeals.reduce((sum, deal) => sum + toNumber(deal.amount), 0),
      totalNegocios: closedDeals.length,
      advisorData: Array.from(byAdvisor.values()).sort((a, b) => b.ventas - a.ventas).slice(0, 10),
      productData: Array.from(byProduct.values()).sort((a, b) => b.ventas - a.ventas).slice(0, 10),
      dayData: Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value).slice(-30),
      monthData: Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value),
      stageData,
      stageTotal,
    }
  }, [deals])

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    : ''

  if (isLoading) {
    return <div className={styles.wallboard}><div className={styles.state}>Cargando pantalla...</div></div>
  }

  if (isError) {
    return <div className={styles.wallboard}><div className={styles.state}>{error?.message || 'Error al cargar datos'}</div></div>
  }

  return (
    <main className={styles.wallboard}>
      <header className={styles.header}>
        <div>
          <p>Trimestre actual</p>
          <h1>Dashboard comercial</h1>
        </div>
        <div className={styles.kpis}>
          <span>{money(metrics.totalVentas)}</span>
          <small>{number(metrics.totalNegocios)} negocios cerrados</small>
          <small>Actualizado {lastUpdate}</small>
        </div>
      </header>

      <div className={styles.grid}>
        <Panel title="Ventas por asesor" meta="Top 10">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={metrics.advisorData} layout="vertical" margin={{ top: 6, right: 18, bottom: 6, left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
              <XAxis type="number" tickFormatter={compactMoney} tick={{ fill: '#8a8fa8', fontSize: 11 }} />
              <YAxis type="category" dataKey="asesor" width={118} tick={{ fill: '#f0f2f8', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="ventas" name="Ventas" radius={[0, 6, 6, 0]}>
                {metrics.advisorData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Productos vendidos" meta="Por elemento de pedido">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={metrics.productData} margin={{ top: 6, right: 12, bottom: 54, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
              <XAxis dataKey="producto" angle={-35} textAnchor="end" interval={0} tick={{ fill: '#8a8fa8', fontSize: 10 }} />
              <YAxis tickFormatter={compactMoney} tick={{ fill: '#8a8fa8', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="ventas" name="Ventas" radius={[6, 6, 0, 0]} fill="#34d399" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Ventas diarias del trimestre" meta="Dias con cierre del trimestre">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics.dayData} margin={{ top: 10, right: 20, bottom: 8, left: 0 }}>
              <defs>
                <linearGradient id="salesArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f8ef7" stopOpacity={0.55} />
                  <stop offset="95%" stopColor="#4f8ef7" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
              <XAxis dataKey="fecha" tick={{ fill: '#8a8fa8', fontSize: 10 }} />
              <YAxis tickFormatter={compactMoney} tick={{ fill: '#8a8fa8', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="ventas" name="Ventas" stroke="#4f8ef7" fill="url(#salesArea)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Ventas mensuales del trimestre y etapas" meta="Comparativa trimestral">
          <div className={styles.splitPanel}>
            <div className={styles.monthChart}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.monthData} margin={{ top: 10, right: 12, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                  <XAxis dataKey="mes" tick={{ fill: '#8a8fa8', fontSize: 10 }} />
                  <YAxis tickFormatter={compactMoney} tick={{ fill: '#8a8fa8', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="ventas" name="Ventas" fill="#e8b84b" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="negocios" name="Negocios" fill="#4f8ef7" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className={styles.stagePanel}>
              <div className={styles.stageHeader}>
                <span>Etapas</span>
                <strong>{number(metrics.stageTotal)}</strong>
              </div>
              <div className={styles.stageList}>
                {metrics.stageData.map((stage, index) => (
                  <div key={`${stage.etapa}-${index}`} className={styles.stageRow}>
                    <div className={styles.stageMeta}>
                      <span>{stage.etapa}</span>
                      <strong>{number(stage.value)} · {stage.pct}%</strong>
                    </div>
                    <div className={styles.stageTrack}>
                      <div
                        className={styles.stageFill}
                        style={{
                          width: `${stage.pct}%`,
                          background: COLORS[index % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </main>
  )
}
