import { useMemo } from 'react'
import { useRankingAsesores, useVentasWeb } from '../hooks/useData'
import AdvisorAvatar from './AdvisorAvatar'

// Paleta exacta del diseño (ventas_por_asesor.html)
const PALETTE = ['#00FFD6', '#4FD1FF', '#8A5CFF', '#FF2E7E', '#FFB800']

const fmtInt = n => new Intl.NumberFormat('es-MX').format(n || 0)

const fmtMXN = n => new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
}).format(n || 0)

const fmtCompact = n => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n || 0)}`
}

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

// El embudo (Interesados/Promesas) ahora vive en la etapa del negocio, no en
// hs_lead_status del contacto — "embudo.porAsesor" lo arma n8n desde un snapshot
// completo del pipeline (ver getEmbudoSnapshot en Construir Dataset Optimizado.js).
function porAsesorMap(embudo) {
  const map = new Map()
  for (const row of embudo?.porAsesor || []) {
    map.set(String(row.ownerId), row)
    map.set(normalizeName(row.nombre), row)
  }
  return map
}

function getEmbudoCount(map, asesor, campo) {
  const row = map.get(String(asesor.ownerId)) || map.get(normalizeName(asesor.nombre))
  return row?.[campo] || 0
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
.pdd-card{ background:var(--s1); border:1px solid rgba(255,255,255,0.06); padding:24px; position:relative; }
.pdd-card::before, .pdd-card::after{ content:''; position:absolute; width:14px; height:14px; pointer-events:none; }
.pdd-card::before{ top:-1px; left:-1px; border-top:2px solid var(--cyan); border-left:2px solid var(--cyan); }
.pdd-card::after{ bottom:-1px; right:-1px; border-bottom:2px solid var(--cyan); border-right:2px solid var(--cyan); }
.pdd-kpi{ padding:22px 28px; margin-bottom:16px; background:linear-gradient(135deg, rgba(0,255,214,0.08), rgba(255,46,126,0.04)); border-color:rgba(0,255,214,0.3); display:flex; gap:40px; flex-wrap:wrap; }
.pdd-kpi-label{ font-size:11.5px; color:var(--muted); text-transform:uppercase; letter-spacing:0.09em; font-weight:700; }
.pdd-kpi-value{ font-weight:700; font-size:30px; letter-spacing:-0.01em; color:var(--cyan); text-shadow:0 0 18px rgba(0,255,214,0.35); margin-top:6px; }
.pdd-card-title{ display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; padding-bottom:14px; border-bottom:1px solid rgba(255,255,255,0.06); }
.pdd-card-title h2{ font-size:16px; font-weight:700; color:var(--text); }
.pdd-card-title h2::before{ content:'▸ '; color:var(--cyan); }
.pdd-card-title span{ font-size:11.5px; color:var(--muted); font-weight:600; letter-spacing:0.03em; }
.pdd-table{ width:100%; border-collapse:collapse; }
.pdd-table th{ text-align:left; font-size:11.5px; text-transform:uppercase; letter-spacing:0.06em; color:var(--muted); font-weight:700; padding:0 12px 14px 12px; }
.pdd-table th.num{ text-align:right; }
.pdd-table td{ padding:14px 12px; font-size:14.5px; border-top:1px solid rgba(255,255,255,0.06); vertical-align:middle; color:var(--text); }
.pdd-table tr:hover td{ background:rgba(0,255,214,0.02); }
.pdd-rank{ font-weight:700; font-size:14px; color:var(--muted); }
.pdd-asesor-cell{ display:flex; align-items:center; gap:12px; }
.pdd-avatar{ border-radius:50%; flex-shrink:0; border:1.5px solid var(--c); box-shadow:0 0 8px var(--c-glow); background:#0d1416; }
.pdd-asesor-name{ font-weight:700; font-size:14.5px; color:var(--text); }
.pdd-num{ text-align:right; color:var(--muted); font-weight:500; }
.pdd-num.total{ color:var(--c); font-weight:700; font-size:15px; }
.pdd-meta-cell{ display:flex; flex-direction:column; gap:6px; min-width:150px; }
.pdd-mini-track{ height:4px; width:100%; background:rgba(255,255,255,0.06); border-radius:3px; overflow:hidden; }
.pdd-mini-fill{ height:100%; border-radius:3px; background:var(--c); box-shadow:0 0 6px var(--c-glow); transform-origin:right; transition:width .8s cubic-bezier(0.16,1,0.3,1); }
.pdd-mini-fill.hit{ background:var(--amber); box-shadow:0 0 8px rgba(255,184,0,0.6); }
.pdd-meta-label{ font-size:10.5px; text-align:right; color:var(--dim); }
.pdd-meta-label.hit{ color:var(--amber); font-weight:700; }
.pdd-web-icon{ border-radius:50%; flex-shrink:0; border:1.5px solid var(--c); box-shadow:0 0 8px var(--c-glow); background:#0d1416; display:flex; align-items:center; justify-content:center; }
.pdd-table tr.web-row{ opacity:0.85; }
@media (max-width:900px){
  .pdd-table th:nth-child(3), .pdd-table td:nth-child(3),
  .pdd-table th:nth-child(4), .pdd-table td:nth-child(4),
  .pdd-table th:nth-child(5), .pdd-table td:nth-child(5){ display:none; }
  .pdd-meta-cell{ min-width:100px; }
}
`

export default function PantallaDatosDelDia({ tvMode = false }) {
  const diaQ = useRankingAsesores('diario', 5 * 60_000)
  // Ídem que Datos del Mes: KPI adicional, no debe bloquear el resto de la pantalla.
  const ventasWebQ = useVentasWeb(5 * 60_000)

  const ranking = diaQ.data?.ranking || []
  const embudo = diaQ.data?.embudo || null
  const embudoByAdvisor = useMemo(() => porAsesorMap(embudo), [embudo])
  const ventasWeb = ventasWebQ.data || null

  if (diaQ.isLoading) return <div className="state-box" style={{ paddingTop: 60 }}>Cargando pantalla…</div>
  // Si ya había datos de una carga anterior, un fallo del refresco en segundo plano
  // no debe tapar la pantalla con el error — se sigue mostrando lo último que cargó
  // bien. Solo se muestra el error si nunca hubo datos.
  if (diaQ.isError && !diaQ.data) return <div className="state-box" style={{ paddingTop: 60, color: 'var(--red-w)' }}>Error: {diaQ.error?.message}</div>

  const visible = ranking.filter(a => a.nombre !== 'Sin asesor asignado')
  const avatarSize = tvMode ? 46 : 38
  // Incluye lo vendido por Ponch (Web) de hoy (ver totalHoy en
  // n8n/ventas-web-diegodiaz-webhook.json), igual que "Total Vendido" en Datos del Mes.
  const ventasTotalesDia = visible.reduce((s, a) => s + (a.totalVentas || 0), 0) + (ventasWeb?.totalHoy || 0)

  // Ponch (Web) compite por posición como un asesor más, igual que en Datos del Mes.
  const rankedRows = [
    ...visible.map(a => ({ kind: 'asesor', ...a })),
    ...(ventasWeb ? [{
      kind: 'web',
      ownerId: 'ponch-web',
      nombre: 'Ponch (Web)',
      totalVentas: ventasWeb.totalHoy || 0,
      totalLlamadas: null,
      avanceMetaPct: null,
      metaPeriodo: null,
    }] : []),
  ].sort((a, b) => (b.totalVentas || 0) - (a.totalVentas || 0))

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <style>{CSS}</style>
      <div className="pdd-card pdd-kpi">
        <div>
          <div className="pdd-kpi-label">// Ventas Totales · hoy</div>
          <div className="pdd-kpi-value">{fmtMXN(ventasTotalesDia)}</div>
        </div>
        {embudo && (
          <div>
            <div className="pdd-kpi-label">// Cantidad total de negocio</div>
            <div className="pdd-kpi-value">{fmtMXN(embudo.cantidadTotal)}</div>
          </div>
        )}
        {embudo && (
          <div>
            <div className="pdd-kpi-label">// Cantidad ponderada de negocio</div>
            <div className="pdd-kpi-value">{fmtMXN(embudo.cantidadPonderada)}</div>
          </div>
        )}
        {embudo && (
          <div>
            <div className="pdd-kpi-label">// Cantidad de negocio abierto</div>
            <div className="pdd-kpi-value">{fmtMXN(embudo.cantidadAbierta)}</div>
          </div>
        )}
        {embudo && (
          <div>
            <div className="pdd-kpi-label">// Cantidad de nuevo negocio</div>
            <div className="pdd-kpi-value">{fmtMXN(embudo.cantidadNuevoNegocio)}</div>
          </div>
        )}
      </div>
      <div className="pdd-card">
        <div className="pdd-card-title">
          <h2>Resumen por Asesor</h2>
          <span>{visible.length} ASESORES</span>
        </div>
        <table className="pdd-table">
          <colgroup>
            <col style={{ width: 36 }} />
            <col style={{ width: 'auto' }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: '26%' }} />
            <col style={{ width: 110 }} />
          </colgroup>
          <thead>
            <tr>
              <th>#</th>
              <th>ASESOR</th>
              <th className="num">LLAMADAS</th>
              <th className="num">INTERESADOS</th>
              <th className="num">PROMESAS</th>
              <th className="num">SHARE</th>
              <th className="num">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {rankedRows.map((a, i) => {
              const isWeb = a.kind === 'web'
              const accent = isWeb ? '#4FD1FF' : PALETTE[i % PALETTE.length]
              const vars = colorVars(accent)
              const metaPct = a.avanceMetaPct || 0
              const metaHit = metaPct >= 100
              return (
                <tr key={a.ownerId} style={vars} className={isWeb ? 'web-row' : undefined}>
                  <td><div className="pdd-rank">{i + 1}</div></td>
                  <td>
                    <div className="pdd-asesor-cell">
                      {isWeb ? (
                        <div className="pdd-web-icon" style={{
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
                          className="pdd-avatar"
                          style={{
                            width: avatarSize, height: avatarSize,
                            color: accent, background: `${accent}24`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'var(--sans)', fontWeight: 'bold', fontSize: avatarSize * 0.34,
                          }}
                        />
                      )}
                      <span className="pdd-asesor-name" style={{ fontSize: tvMode ? 16 : 14.5 }}>{a.nombre}</span>
                    </div>
                  </td>
                  <td className="pdd-num">{isWeb ? '—' : fmtInt(a.totalLlamadas)}</td>
                  <td className="pdd-num">{isWeb ? '—' : fmtInt(getEmbudoCount(embudoByAdvisor, a, 'interesados'))}</td>
                  <td className="pdd-num">{isWeb ? '—' : fmtInt(getEmbudoCount(embudoByAdvisor, a, 'promesas'))}</td>
                  <td>
                    {isWeb ? (
                      <div className="pdd-meta-cell">
                        <span className="pdd-meta-label">mes en curso: {fmtCompact(ventasWeb?.totalMesActual || 0)}</span>
                      </div>
                    ) : (
                      <div className="pdd-meta-cell">
                        <div className="pdd-mini-track">
                          <div className={`pdd-mini-fill${metaHit ? ' hit' : ''}`} style={{ width: `${Math.min(100, metaPct)}%` }} />
                        </div>
                        <div className={`pdd-meta-label${metaHit ? ' hit' : ''}`}>{metaPct}% de meta · {fmtCompact(a.metaPeriodo)}</div>
                      </div>
                    )}
                  </td>
                  <td className="pdd-num total">${(a.totalVentas || 0).toLocaleString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!visible.length && <div className="state-box">Sin ventas registradas hoy</div>}
      </div>
    </div>
  )
}
