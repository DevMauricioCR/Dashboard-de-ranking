import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area, CartesianGrid,
} from 'recharts'
import { useRankingAsesores, useRankingProducto, useLeadsContactados } from '../hooks/useData'

const fmtMXN = n => new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
}).format(n)

const compactMoney = n => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`
  return `$${Math.round(n)}`
}

const HUD_COLORS = [
  '#00ffd6','#4fd1ff','#8a5cff','#ff2e7e','#ffb800',
  '#00a88f','#bda7ff','#ff6b9f','#7fd9c8','#ffd166',
]

function Panel({ title, meta, children, style }) {
  return (
    <div className="panel" style={style}>
      <div className="panel-head">
        <span className="panel-title">{title}</span>
        {meta && <span className="panel-meta">{meta}</span>}
      </div>
      <div className="report-panel-body" style={{ padding: '16px 0 8px' }}>
        {children}
      </div>
    </div>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--s3)', border: '1px solid var(--b3)',
      padding: '8px 12px', fontFamily: 'var(--sans)',
    }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
      {payload.map(item => (
        <div key={item.name} style={{ fontSize: 12, color: item.color || 'var(--text)' }}>
          {typeof item.value === 'number' && (item.name?.toLowerCase().includes('venta') || item.name?.toLowerCase().includes('monto'))
            ? fmtMXN(item.value)
            : item.value}
        </div>
      ))}
    </div>
  )
}

function stageType(s) {
  const v = String(s || '').toLowerCase()
  if (v === 'closedwon' || v === '1338692463' || v.includes('won') || v.includes('ganado') || v.includes('exitoso')) return 'ganado'
  if (v.includes('lost') || v.includes('perdido')) return 'perdido'
  return 'proceso'
}

export default function VistaReportes({ periodo, tvMode = false }) {
  const rankQ  = useRankingAsesores(periodo)
  const prodQ  = useRankingProducto(periodo)
  const leadsQ = useLeadsContactados(periodo)

  const ranking = rankQ.data?.ranking  || []
  const prods   = prodQ.data?.ranking  || []
  const leads   = leadsQ.data?.leads   || []

  const isLoading = rankQ.isLoading || prodQ.isLoading || leadsQ.isLoading

  const callsByAdvisor = useMemo(() => leads.reduce((acc, lead) => {
    const key = lead.asesorId || lead.asesor || ''
    acc[key] = (acc[key] || 0) + (Number(lead.totalLlamadas) || 0)
    return acc
  }, {}), [leads])
  const getAdvisorCalls = asesor =>
    Number(asesor.totalLlamadas) ||
    callsByAdvisor[asesor.ownerId] ||
    callsByAdvisor[asesor.nombre] ||
    0

  // Timeline: group leads by date
  const timeline = useMemo(() => {
    const byDay = new Map()
    for (const l of leads) {
      const date = l.ultimaLlamada ? new Date(l.ultimaLlamada).toISOString().slice(0, 10) : null
      if (!date) continue
      const cur = byDay.get(date) || { fecha: date.slice(5), ventas: 0, deals: 0 }
      if (stageType(l.estadoNegocio) === 'ganado') {
        cur.ventas += l.monto || 0
        cur.deals  += 1
      }
      byDay.set(date, cur)
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v)
      .slice(-30)
  }, [leads])

  // Pipeline distribution
  const pipeline = useMemo(() => {
    const ganados  = leads.filter(l => stageType(l.estadoNegocio) === 'ganado').length
    const proceso  = leads.filter(l => stageType(l.estadoNegocio) === 'proceso').length
    const perdidos = leads.filter(l => stageType(l.estadoNegocio) === 'perdido').length
    return [
      { name: 'Ganados',    value: ganados,  fill: '#00ffd6' },
      { name: 'En proceso', value: proceso,  fill: '#8a5cff' },
      { name: 'Perdidos',   value: perdidos, fill: '#ff2e7e' },
    ].filter(d => d.value > 0)
  }, [leads])

  // Asesor chart data (top 10)
  const asesorData = ranking.slice(0, 10).map(a => ({
    asesor: a.nombre.trim().split(/\s+/).slice(0, 2).join(' '),
    ventas: a.totalVentas,
    deals:  a.numeroDeals,
    llamadas: getAdvisorCalls(a),
  }))
  const callsData = ranking
    .map(a => ({
      asesor: a.nombre.trim().split(/\s+/).slice(0, 2).join(' '),
      llamadas: getAdvisorCalls(a),
    }))
    .sort((a, b) => b.llamadas - a.llamadas)
    .slice(0, 10)

  // Product chart data (top 8)
  const shortName = name => {
    const words = name.trim().split(/\s+/)
    const short  = words.slice(0, 2).join(' ')
    return short.length > 16 ? short.substring(0, 15) + '…' : short
  }

  const prodData = prods.slice(0, 8).map(p => ({
    producto: shortName(p.producto),
    ventas:   p.totalVentas,
    unidades: p.unidades,
  }))

  if (isLoading) return (
    <div className="state-box" style={{ paddingTop: 60 }}>Cargando reportes…</div>
  )

  const totalVentas = ranking.reduce((s, a) => s + a.totalVentas, 0)
  const totalDeals  = ranking.reduce((s, a) => s + a.numeroDeals, 0)
  const totalLlamadas = ranking.reduce((s, a) => s + getAdvisorCalls(a), 0)
  const avgTicket   = totalDeals > 0 ? totalVentas / totalDeals : 0
  const pipelineTotal = pipeline.reduce((sum, item) => sum + item.value, 0) || 1
  const wonPct = ((pipeline.find(item => item.name === 'Ganados')?.value || 0) / pipelineTotal) * 100
  const processPct = ((pipeline.find(item => item.name === 'En proceso')?.value || 0) / pipelineTotal) * 100
  const pipelineGradient = `conic-gradient(
    #00ffd6 0% ${wonPct}%,
    #8a5cff ${wonPct}% ${wonPct + processPct}%,
    #ff2e7e ${wonPct + processPct}% 100%
  )`

  return (
    <div className="reports-view">
      {/* HEADER */}
      <div className="reports-header" style={{ paddingBottom: 16, borderBottom: '1px solid var(--b2)' }}>
        <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 4 }}>
          Reportes
        </div>
        <div style={{ display: 'flex', gap: 32, alignItems: 'baseline' }}>
          <div style={{ fontSize: 20, fontWeight: 'bold', letterSpacing: '-0.03em', color: 'var(--text)' }}>
            {fmtMXN(totalVentas)}
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--muted)' }}>
            {totalDeals} deals &nbsp;·&nbsp; {totalLlamadas} llamadas &nbsp;·&nbsp; {fmtMXN(Math.round(avgTicket))} ticket prom.
          </div>
        </div>
      </div>

      {/* ROW 1: Ventas, llamadas y productos */}
      <div className="reports-grid reports-grid-main">
        <Panel title="Ventas por asesor" meta="Top 10">
          <ResponsiveContainer className="report-chart report-chart--main" width="100%" height={tvMode ? '100%' : 260}>
            <BarChart data={asesorData} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: tvMode ? 18 : 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" horizontal={false} />
              <XAxis type="number" tickFormatter={compactMoney} tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="asesor" width={tvMode ? 112 : 118} interval={0} tick={{ fill: 'var(--text)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="ventas" name="Ventas" radius={[0, 3, 3, 0]} barSize={tvMode ? 28 : 14} isAnimationActive={!tvMode} animationDuration={1100} animationBegin={120}>
                {asesorData.map((_, i) => (
                  <Cell key={i} fill={HUD_COLORS[i % HUD_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Llamadas por asesor" meta={`${totalLlamadas} total`}>
          <ResponsiveContainer className="report-chart report-chart--main" width="100%" height={tvMode ? '100%' : 260}>
            <BarChart data={callsData} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: tvMode ? 18 : 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="asesor" width={tvMode ? 112 : 118} interval={0} tick={{ fill: 'var(--text)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="llamadas" name="Llamadas" radius={[0, 3, 3, 0]} barSize={tvMode ? 28 : 14} isAnimationActive={!tvMode} animationDuration={1100} animationBegin={180}>
                {callsData.map((_, i) => (
                  <Cell key={i} fill={HUD_COLORS[(i + 2) % HUD_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Top productos" meta="por ingreso">
          <ResponsiveContainer className="report-chart report-chart--main" width="100%" height={tvMode ? '100%' : 260}>
            <BarChart data={prodData} margin={{ top: 0, right: 16, bottom: 50, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" vertical={false} />
              <XAxis dataKey="producto" angle={-35} textAnchor="end" interval={0} tick={{ fill: 'var(--muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={compactMoney} tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="ventas" name="Ventas" radius={[3, 3, 0, 0]} barSize={tvMode ? 30 : 20} isAnimationActive={!tvMode} animationDuration={1100} animationBegin={220}>
                {prodData.map((_, i) => (
                  <Cell key={i} fill={HUD_COLORS[i % HUD_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* ROW 2: Timeline + Pipeline */}
      <div className="reports-grid reports-grid-pipeline">
        <Panel title="Ventas diarias" meta="Negocios cerrados">
          <ResponsiveContainer className="report-chart report-chart--timeline" width="100%" height={tvMode ? '100%' : 200}>
            <AreaChart data={timeline} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="goldArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00ffd6" stopOpacity={0.38} />
                  <stop offset="55%" stopColor="#8a5cff" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#ff2e7e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
              <XAxis dataKey="fecha" tick={{ fill: 'var(--muted)', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={compactMoney} tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--gold)', strokeWidth: 1 }} />
              <Area type="monotone" dataKey="ventas" name="Ventas" stroke="#00ffd6" fill="url(#goldArea)" strokeWidth={tvMode ? 3 : 2} dot={false} isAnimationActive={!tvMode} animationDuration={1400} animationBegin={280} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Pipeline" meta={`${leads.length} total`}>
          <div className="pipeline-chart-content" style={{ padding: '0 16px' }}>
            <div className="pipeline-donut-wrap">
              <div
                className="pipeline-donut"
                style={{ background: pipelineGradient }}
                role="img"
                aria-label={`Pipeline: ${pipeline.map(item => `${item.name} ${item.value}`).join(', ')}`}
              />
            </div>

            {/* legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              {pipeline.map(d => {
                const pct = leads.length > 0 ? ((d.value / leads.length) * 100).toFixed(1) : '0'
                return (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, background: d.fill, borderRadius: 1 }} />
                      <span style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--muted)' }}>{d.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--text)' }}>{d.value}</span>
                      <span style={{ fontFamily: 'var(--sans)', fontSize: 9, color: 'var(--dim)' }}>{pct}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Panel>
      </div>

      {/* ROW 3: Tabla resumen asesores */}
      <div className="report-summary">
      <Panel title="Resumen por asesor" meta={`${ranking.length} asesores`}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '32px 1fr 70px 85px 100px 120px 120px',
            padding: '6px 18px',
            borderBottom: '1px solid var(--b2)',
            gap: 8,
          }}>
            {['#','Asesor','Deals','Llamadas','Promedio','Total','Share'].map((h, i) => (
              <div key={h} className="col-hdr" style={i > 2 ? { textAlign: 'right' } : {}}>{h}</div>
            ))}
          </div>
          {ranking.map(a => {
            const pct = (a.totalVentas / (totalVentas || 1) * 100).toFixed(1)
            const accent = HUD_COLORS[(Math.max(1, a.posicion) - 1) % HUD_COLORS.length]
            return (
              <div
                key={a.ownerId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '32px 1fr 70px 85px 100px 120px 120px',
                  padding: '9px 18px',
                  borderBottom: '1px solid var(--b1)',
                  gap: 8,
                  transition: 'background .12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--b1)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}
              >
                <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--dim)', fontSize: 13 }}>{a.posicion}</div>
                <div style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nombre}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{a.numeroDeals}</div>
                <div style={{ fontSize: 11, color: 'var(--cyan)' }}>{getAdvisorCalls(a)}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>{fmtMXN(Math.round(a.totalVentas / (a.numeroDeals || 1)))}</div>
                <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13, color: accent, textAlign: 'right' }}>{fmtMXN(a.totalVentas)}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--b3)', overflow: 'hidden', maxWidth: 60 }}>
                    <div style={{ height: '100%', width: pct + '%', background: accent, boxShadow: `0 0 7px ${accent}` }} />
                  </div>
                  <span style={{ fontFamily: 'var(--sans)', fontSize: 9, color: 'var(--dim)', width: 32, textAlign: 'right' }}>{pct}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </Panel>
      </div>
    </div>
  )
}
