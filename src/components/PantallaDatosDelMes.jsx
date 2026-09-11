import { useMemo } from 'react'
import { useRankingAsesores, useVentasWeb } from '../hooks/useData'
import AdvisorAvatar from './AdvisorAvatar'

// Paleta y layout exactos del diseño (datos_del_mes.html)
const PALETTE = ['#00FFD6', '#4FD1FF', '#8A5CFF', '#FF2E7E', '#FFB800']
const MEDALS = ['🥇', '🥈', '🥉']

const fmtMXN = n => new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
}).format(n || 0)

const fmtCompact = n => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n || 0)}`
}

const fmtInt = n => new Intl.NumberFormat('es-MX').format(n || 0)

function initials(name = '') {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return name.substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function hexToRgb(hex) {
  const v = hex.replace('#', '')
  return [0, 2, 4].map(i => parseInt(v.substr(i, 2), 16))
}

function colorVars(hex) {
  const [r, g, b] = hexToRgb(hex)
  return {
    '--c': hex,
    '--c-fade': `rgba(${r},${g},${b},0.14)`,
    '--c-glow': `rgba(${r},${g},${b},0.55)`,
  }
}

const CSS = `
.pdm-card{ background:var(--s1); border:1px solid rgba(255,255,255,0.06); padding:24px; position:relative; }
.pdm-card::before, .pdm-card::after{ content:''; position:absolute; width:14px; height:14px; pointer-events:none; }
.pdm-card::before{ top:-1px; left:-1px; border-top:2px solid var(--cyan); border-left:2px solid var(--cyan); }
.pdm-card::after{ bottom:-1px; right:-1px; border-bottom:2px solid var(--cyan); border-right:2px solid var(--cyan); }
.pdm-kpi{ padding:22px 28px; margin-bottom:16px; background:linear-gradient(135deg, rgba(0,255,214,0.08), rgba(255,46,126,0.04)); border-color:rgba(0,255,214,0.3); display:flex; gap:40px; flex-wrap:wrap; }
.pdm-kpi-label{ font-size:11.5px; color:var(--muted); text-transform:uppercase; letter-spacing:0.09em; font-weight:700; }
.pdm-kpi-value{ font-weight:700; font-size:30px; letter-spacing:-0.01em; color:var(--cyan); text-shadow:0 0 18px rgba(0,255,214,0.35); margin-top:6px; }
.pdm-card-title{ display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; padding-bottom:14px; border-bottom:1px solid rgba(255,255,255,0.06); }
.pdm-card-title h2{ font-size:16px; font-weight:700; color:var(--text); }
.pdm-card-title h2::before{ content:'▸ '; color:var(--cyan); }
.pdm-card-title span{ font-size:11.5px; color:var(--muted); font-weight:600; letter-spacing:0.03em; }
.pdm-col-heads{ display:grid; grid-template-columns:34px 1fr 190px 150px 190px; gap:14px; padding:0 16px 10px 16px; font-size:11px; font-weight:700; letter-spacing:0.06em; color:var(--muted); text-transform:uppercase; }
.pdm-col-heads .r{ text-align:right; }
.pdm-rows{ display:flex; flex-direction:column; gap:8px; }
.pdm-row{ display:grid; grid-template-columns:34px 1fr 190px 150px 190px; align-items:center; gap:14px; background:var(--s2); border:1px solid rgba(255,255,255,0.06); border-left:3px solid var(--c); border-radius:8px; padding:13px 16px; transition:transform .18s ease, box-shadow .18s ease; }
.pdm-row:hover{ transform:translateY(-2px); box-shadow:0 8px 22px -8px var(--c-glow); }
.pdm-row.top1{ background:linear-gradient(90deg, rgba(255,184,0,0.07), var(--s2) 40%); }
.pdm-rank{ font-weight:800; font-size:15px; color:var(--muted); text-align:center; }
.pdm-medal{ font-size:19px; line-height:1; text-align:center; }
.pdm-asesor-cell{ display:flex; align-items:center; gap:12px; min-width:0; }
.pdm-avatar{ border-radius:50%; flex-shrink:0; border:1.5px solid var(--c); box-shadow:0 0 8px var(--c-glow); background:#0d1416; }
.pdm-asesor-name{ font-weight:700; font-size:14.5px; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pdm-metric{ display:flex; flex-direction:column; gap:6px; }
.pdm-metric-val{ font-weight:700; font-size:15px; text-align:right; color:var(--text); }
.pdm-metric-val.accent{ color:var(--c); }
.pdm-metric.llamadas{ align-items:center; margin-right:20px; }
.pdm-metric.llamadas .pdm-metric-val{ text-align:center; }
.pdm-mini-track{ height:4px; width:100%; background:rgba(255,255,255,0.06); border-radius:3px; overflow:hidden; }
.pdm-mini-fill{ height:100%; border-radius:3px; background:var(--c); box-shadow:0 0 6px var(--c-glow); transform-origin:right; transition:width .8s cubic-bezier(0.16,1,0.3,1); }
.pdm-mini-fill.hit{ background:var(--amber); box-shadow:0 0 8px rgba(255,184,0,0.6); }
.pdm-meta-label{ font-size:10.5px; text-align:right; color:var(--dim); }
.pdm-meta-label.hit{ color:var(--amber); font-weight:700; }
.pdm-perf{ display:flex; flex-direction:column; align-items:flex-end; gap:2px; }
.pdm-pill{ display:inline-flex; align-items:center; gap:6px; padding:5px 11px; border-radius:20px; font-weight:700; font-size:13px; }
.pdm-pill.up{ background:rgba(95,245,214,0.12); color:#5FF5D6; }
.pdm-pill.down{ background:rgba(255,107,147,0.12); color:#FF6B93; }
.pdm-perf-prev{ font-size:10.5px; color:var(--dim); font-weight:500; }
.pdm-row.web-row{ opacity:0.85; }
.pdm-web-icon{ border-radius:50%; flex-shrink:0; border:1.5px solid var(--c); box-shadow:0 0 8px var(--c-glow); background:#0d1416; display:flex; align-items:center; justify-content:center; }
@media (max-width:900px){
  .pdm-col-heads{ display:none; }
  .pdm-row{ grid-template-columns:28px 1fr; grid-template-areas:"rank name" "rank llamadas" "rank ventas" "rank perf"; row-gap:8px; }
  .pdm-rank, .pdm-medal{ grid-area:rank; }
  .pdm-asesor-cell{ grid-area:name; }
  .pdm-metric.llamadas{ grid-area:llamadas; margin-right:0; align-items:flex-start; }
  .pdm-metric.llamadas .pdm-metric-val{ text-align:left; }
  .pdm-metric.ventas{ grid-area:ventas; }
  .pdm-perf{ grid-area:perf; align-items:flex-start; }
}
`

export default function PantallaDatosDelMes({ tvMode = false }) {
  const mesQ = useRankingAsesores('mensual', 60 * 60_000)
  // "Mes pasado" es un dato secundario (comparación de rendimiento): si el
  // webhook tarda o falla no debe bloquear la pantalla, solo se omite el
  // trend de esa fila.
  const prevQ = useRankingAsesores('mes_pasado', 60 * 60_000)
  // Ídem: ventas web es un KPI adicional, no debe bloquear el resto de la pantalla.
  // Se refresca cada hora (no cambia minuto a minuto, y así no le pega tan seguido a
  // la API de Diego Diaz) -- coincide con el TTL de cache del lado de n8n.
  const ventasWebQ = useVentasWeb(60 * 60_000)

  const ranking = mesQ.data?.ranking || []
  const embudo = mesQ.data?.embudo || null
  const ventasWeb = ventasWebQ.data || null
  const prevRanking = prevQ.data?.ranking || []
  const hasPrevData = prevQ.isSuccess

  const prevByKey = useMemo(() => {
    const map = new Map()
    for (const row of prevRanking) {
      map.set(String(row.ownerId), row.totalVentas || 0)
      map.set(normalizeName(row.nombre), row.totalVentas || 0)
    }
    return map
  }, [prevRanking])

  if (mesQ.isLoading) return <div className="state-box" style={{ paddingTop: 60 }}>Cargando pantalla…</div>
  // Con datos previos, un fallo del refresco en segundo plano no debe tapar la
  // pantalla — se sigue mostrando lo último que cargó bien.
  if (mesQ.isError && !mesQ.data) return <div className="state-box" style={{ paddingTop: 60, color: 'var(--red-w)' }}>Error: {mesQ.error?.message}</div>

  const visible = ranking
    .filter(a => a.nombre !== 'Sin asesor asignado')
    .map(a => {
      if (!hasPrevData) return { ...a, prevValue: null, trend: null }
      const prevValue = prevByKey.get(String(a.ownerId)) ?? prevByKey.get(normalizeName(a.nombre)) ?? 0
      const trend = prevValue ? ((a.totalVentas - prevValue) / prevValue) * 100 : (a.totalVentas > 0 ? 100 : 0)
      return { ...a, prevValue, trend }
    })

  const avatarSize = tvMode ? 46 : 38
  // "Total Vendido" cuenta un negocio ganado por su fecha de CREACIÓN (ver
  // filterClosedDealsByPeriod en useData.ts), para cuadrar con el tablero de HubSpot
  // -- que siempre está filtrado por "Fecha de creación", nunca por fecha de cierre.
  // Da el mismo número que embudo.valorCerrado (misma fuente/criterio); se suma acá
  // desde la tabla para que quede consistente con la fila de cada asesor. Incluye
  // también lo vendido por Ponch (Web), que compite en la misma tabla de abajo.
  const totalVendidoMes = visible.reduce((s, a) => s + (a.totalVentas || 0), 0) + (ventasWeb?.totalMesActual || 0)

  // Mismo criterio de tendencia que cada asesor (vs. mes anterior) -- ver
  // getPrevMonthRange en n8n/ventas-web-diegodiaz-webhook.json.
  const hasPrevWeb = ventasWeb?.totalMesAnterior != null
  const webPrevValue = hasPrevWeb ? ventasWeb.totalMesAnterior : null
  const webTrend = hasPrevWeb
    ? (webPrevValue ? ((ventasWeb.totalMesActual - webPrevValue) / webPrevValue) * 100 : (ventasWeb.totalMesActual > 0 ? 100 : 0))
    : null
  const isUpWeb = webTrend >= 0

  // Ponch (Web) compite por posición como un asesor más -- se mezcla en la misma
  // lista y se reordena por ventas, en vez de ir siempre pegado al final.
  const rankedRows = [
    ...visible.map(a => ({ kind: 'asesor', ...a })),
    ...(ventasWeb ? [{
      kind: 'web',
      ownerId: 'ponch-web',
      nombre: 'Ponch (Web)',
      totalVentas: ventasWeb.totalMesActual,
      totalLlamadas: null,
      trend: webTrend,
      prevValue: webPrevValue,
      avanceMetaPct: null,
      metaPeriodo: null,
    }] : []),
  ].sort((a, b) => (b.totalVentas || 0) - (a.totalVentas || 0))

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <style>{CSS}</style>
      <div className="pdm-card pdm-kpi">
        <div>
          <div className="pdm-kpi-label">// Total Vendido · negocio cerrado</div>
          <div className="pdm-kpi-value">{fmtMXN(totalVendidoMes)}</div>
        </div>
        {embudo && (
          <div>
            <div className="pdm-kpi-label">// Cantidad total de negocio</div>
            <div className="pdm-kpi-value">{fmtMXN(embudo.cantidadTotal)}</div>
          </div>
        )}
        {embudo && (
          <div>
            <div className="pdm-kpi-label">// Cantidad ponderada de negocio</div>
            <div className="pdm-kpi-value">{fmtMXN(embudo.cantidadPonderada)}</div>
          </div>
        )}
        {embudo && (
          <div>
            <div className="pdm-kpi-label">// Cantidad de negocio abierto</div>
            <div className="pdm-kpi-value">{fmtMXN(embudo.cantidadAbierta)}</div>
          </div>
        )}
        {embudo && (
          <div>
            <div className="pdm-kpi-label">// Cantidad de nuevo negocio</div>
            <div className="pdm-kpi-value">{fmtMXN(embudo.cantidadNuevoNegocio)}</div>
          </div>
        )}
        {ventasWeb && (
          <div>
            <div className="pdm-kpi-label">// Ventas Web · mes en curso</div>
            <div className="pdm-kpi-value">{fmtMXN(ventasWeb.totalMesActual)}</div>
          </div>
        )}
      </div>
      <div className="pdm-card">
        <div className="pdm-card-title">
          <h2>Resumen por Asesor</h2>
          <span>{visible.length} ASESORES</span>
        </div>

        <div className="pdm-col-heads">
          <span />
          <span>Asesor</span>
          <span style={{ textAlign: 'center' }}>Llamadas</span>
          <span className="r">Ventas</span>
          <span className="r">Rendimiento (vs. mes ant.)</span>
        </div>

        <div className="pdm-rows">
          {rankedRows.map((a, i) => {
            const isWeb = a.kind === 'web'
            const accent = isWeb ? '#4FD1FF' : PALETTE[i % PALETTE.length]
            const vars = colorVars(accent)
            const isUp = a.trend >= 0
            const metaPct = a.avanceMetaPct || 0
            const metaHit = metaPct >= 100
            return (
              <div key={a.ownerId} className={`pdm-row${i === 0 ? ' top1' : ''}${isWeb ? ' web-row' : ''}`} style={vars}>
                <div>{i < 3 ? <div className="pdm-medal">{MEDALS[i]}</div> : <div className="pdm-rank">{i + 1}</div>}</div>

                <div className="pdm-asesor-cell">
                  {isWeb ? (
                    <div className="pdm-web-icon" style={{
                      width: avatarSize, height: avatarSize,
                      color: accent, background: `${accent}24`,
                      fontFamily: 'var(--sans)', fontWeight: 'bold', fontSize: avatarSize * 0.4,
                      position: 'relative', overflow: 'hidden',
                    }}>
                      <img
                        src="/avatars/ponch.png"
                        alt="Ponch (Web)"
                        onError={e => {
                          e.currentTarget.style.display = 'none'
                          const fb = e.currentTarget.nextElementSibling
                          if (fb) fb.style.display = 'flex'
                        }}
                        style={{
                          position: 'absolute', inset: 0,
                          width: '100%', height: '100%',
                          objectFit: 'cover', objectPosition: '50% 18%',
                        }}
                      />
                      <span style={{
                        display: 'none', position: 'absolute', inset: 0,
                        alignItems: 'center', justifyContent: 'center',
                      }}>🌐</span>
                    </div>
                  ) : (
                    <AdvisorAvatar
                      name={a.nombre}
                      initials={initials(a.nombre)}
                      className="pdm-avatar"
                      style={{
                        width: avatarSize, height: avatarSize,
                        color: accent, background: `${accent}24`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--sans)', fontWeight: 'bold', fontSize: avatarSize * 0.34,
                      }}
                    />
                  )}
                  <span className="pdm-asesor-name" style={{ fontSize: tvMode ? 16 : 14.5 }}>{a.nombre}</span>
                </div>

                <div className="pdm-metric llamadas">
                  <div className="pdm-metric-val">{isWeb ? '—' : fmtInt(a.totalLlamadas)}</div>
                </div>

                <div className="pdm-metric ventas">
                  <div className="pdm-metric-val accent">{fmtMXN(a.totalVentas)}</div>
                  {!isWeb && (
                    <>
                      <div className="pdm-mini-track">
                        <div className={`pdm-mini-fill${metaHit ? ' hit' : ''}`} style={{ width: `${Math.min(100, metaPct)}%` }} />
                      </div>
                      <div className={`pdm-meta-label${metaHit ? ' hit' : ''}`}>{metaPct}% de meta · {fmtCompact(a.metaPeriodo)}</div>
                    </>
                  )}
                </div>

                <div className="pdm-perf">
                  {a.trend === null ? (
                    <span className="pdm-perf-prev">sin dato previo</span>
                  ) : (
                    <>
                      <span className={`pdm-pill ${isUp ? 'up' : 'down'}`}>
                        {isUp ? '📈' : '📉'} {isUp ? '+' : ''}{a.trend.toFixed(1)}%
                      </span>
                      <span className="pdm-perf-prev">antes: {fmtMXN(a.prevValue)}</span>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {!visible.length && <div className="state-box">Sin ventas registradas este mes</div>}
      </div>
    </div>
  )
}
