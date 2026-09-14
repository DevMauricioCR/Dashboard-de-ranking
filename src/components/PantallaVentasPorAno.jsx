import { useVentasAnualesSheet } from '../hooks/useData'
import useRowFit from '../hooks/useRowFit'
import AdvisorAvatar from './AdvisorAvatar'

// Paleta y layout exactos del diseño (ventas_por_ano.html)
const PALETTE = ['#00FFD6', '#4FD1FF', '#8A5CFF', '#FF2E7E', '#FFB800']

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
.pva-screen{ height:100%; overflow:auto; display:flex; flex-direction:column; gap:8px; }
.pva-card{ background:var(--s1); border:1px solid rgba(255,255,255,0.06); padding:18px; position:relative; }
.pva-card::before, .pva-card::after{ content:''; position:absolute; width:14px; height:14px; pointer-events:none; }
.pva-card::before{ top:-1px; left:-1px; border-top:2px solid var(--cyan); border-left:2px solid var(--cyan); }
.pva-card::after{ bottom:-1px; right:-1px; border-bottom:2px solid var(--cyan); border-right:2px solid var(--cyan); }
.pva-table-card{ display:flex; flex-direction:column; }
.pva-table-card.pva-fit{ flex:1; min-height:0; }
.pva-kpi{ padding:12px 22px; margin-bottom:8px; background:linear-gradient(135deg, rgba(0,255,214,0.08), rgba(255,46,126,0.04)); border-color:rgba(0,255,214,0.3); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; flex-shrink:0; }
.pva-kpi-label{ font-size:11.5px; color:var(--muted); text-transform:uppercase; letter-spacing:0.09em; font-weight:700; }
.pva-kpi-value{ font-weight:700; font-size:24px; letter-spacing:-0.01em; color:var(--cyan); text-shadow:0 0 18px rgba(0,255,214,0.35); margin-top:4px; }
.pva-card-title{ display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.06); flex-shrink:0; }
.pva-card-title h2{ font-size:16px; font-weight:700; color:var(--text); }
.pva-card-title h2::before{ content:'▸ '; color:var(--cyan); }
.pva-card-title span{ font-size:11.5px; color:var(--muted); font-weight:600; letter-spacing:0.03em; }
.pva-col-heads{ display:grid; grid-template-columns:1fr 190px; gap:14px; padding:0 16px 4px 16px; font-size:11px; font-weight:700; letter-spacing:0.06em; color:var(--muted); text-transform:uppercase; flex-shrink:0; }
.pva-col-heads .r{ text-align:right; }
.pva-rows{ display:flex; flex-direction:column; gap:calc(4px * var(--row-scale, 1)); }
.pva-rows.pva-fit{ flex:1; min-height:0; overflow:hidden; }
.pva-row{ display:grid; grid-template-columns:1fr 190px; align-items:center; gap:14px; background:var(--s2); border:1px solid rgba(255,255,255,0.06); border-left:3px solid var(--c); border-radius:8px; padding:calc(5px * var(--row-scale, 1)) 14px; overflow:hidden; transition:transform .18s ease, box-shadow .18s ease; }
.pva-rows.pva-fit .pva-row{ flex:1 1 0; min-height:0; }
.pva-row:hover{ transform:translateY(-2px); box-shadow:0 8px 22px -8px var(--c-glow); }
.pva-asesor-cell{ display:flex; align-items:center; gap:12px; min-width:0; }
.pva-avatar{ border-radius:50%; flex-shrink:0; border:1.5px solid var(--c); box-shadow:0 0 8px var(--c-glow); background:#0d1416; }
.pva-asesor-name{ font-weight:700; font-size:calc(14.5px * var(--row-scale, 1)); color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pva-metric-ventas{ display:flex; flex-direction:column; gap:3px; min-width:0; }
.pva-year-val{ text-align:right; font-weight:700; font-size:calc(13px * var(--row-scale, 1)); color:var(--c); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pva-mini-track{ height:4px; width:100%; background:rgba(255,255,255,0.06); border-radius:3px; overflow:hidden; }
.pva-mini-fill{ height:100%; border-radius:3px; background:var(--c); box-shadow:0 0 6px var(--c-glow); transform-origin:right; transition:width .8s cubic-bezier(0.16,1,0.3,1); }
.pva-mini-fill.hit{ background:var(--amber); box-shadow:0 0 8px rgba(255,184,0,0.6); }
.pva-meta-label{ font-size:calc(9px * var(--row-scale, 1)); text-align:right; color:var(--dim); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pva-meta-label.hit{ color:var(--amber); font-weight:700; }
@media (max-width:820px){
  .pva-table-card.pva-fit{ flex:none; }
  .pva-col-heads{ display:none; }
  .pva-rows.pva-fit{ flex:none; overflow:visible; }
  .pva-rows.pva-fit .pva-row{ flex:none; }
  .pva-row{ grid-template-columns:1fr auto; }
  .pva-kpi{ flex-direction:column; align-items:flex-start; }
}
`

export default function PantallaVentasPorAno({ tvMode = false }) {
  // HubSpot no tiene el histórico completo del año (apenas se empezó a usar
  // bien hace ~2 meses): los meses ya cerrados vienen de la hoja de Google
  // Sheets "Venta-Anual-Ranking" (se lee poco seguido, no es "hoy mismo"), y
  // el mes en curso se suma en vivo desde HubSpot (ver useVentasAnualesSheet).
  const anioQ = useVentasAnualesSheet()
  const ranking = anioQ.data?.ranking || []

  // En TV (kiosco sin scroll) las filas se encogen o agrandan automáticamente
  // según cuántos asesores haya y el alto disponible, para que siempre quepan
  // todas sin cortarse -- ver useRowFit.
  const rowCountForFit = ranking.filter(a => a.nombre !== 'Sin asesor asignado').length
  const { containerRef: rowsRef, scale: rowScale } = useRowFit(rowCountForFit, tvMode)

  if (anioQ.isLoading) return <div className="state-box" style={{ paddingTop: 60 }}>Cargando pantalla…</div>
  if (anioQ.isError) return <div className="state-box" style={{ paddingTop: 60, color: 'var(--red-w)' }}>Error: {anioQ.error?.message}</div>

  const visible = ranking.filter(a => a.nombre !== 'Sin asesor asignado')
  const totalGeneral = visible.reduce((s, a) => s + (a.totalVentas || 0), 0)
  const avatarSize = tvMode ? Math.round(36 * rowScale) : 36
  const asesoresActivos = visible.filter(a => a.ownerId !== 'otros-asesores').length

  return (
    <div className="pva-screen">
      <style>{CSS}</style>

      <div className="pva-card pva-kpi">
        <div>
          <div className="pva-kpi-label">// Ventas totales</div>
          <div className="pva-kpi-value">{fmtMXN(totalGeneral)}</div>
        </div>
      </div>

      <div className={`pva-card pva-table-card${tvMode ? ' pva-fit' : ''}`}>
        <div className="pva-card-title">
          <h2>Ventas por Asesor</h2>
          <span>{asesoresActivos} ASESORES ACTIVOS</span>
        </div>

        <div className="pva-col-heads">
          <span>Asesor</span>
          <span className="r">Ventas · Meta anual</span>
        </div>

        <div className={`pva-rows${tvMode ? ' pva-fit' : ''}`} ref={rowsRef} style={{ '--row-scale': tvMode ? rowScale : 1 }}>
          {visible.map((a, i) => {
            const isOtros = a.ownerId === 'otros-asesores'
            const accent = isOtros ? '#6E8B86' : PALETTE[i % PALETTE.length]
            const vars = colorVars(accent)
            const metaPct = a.avanceMetaPct || 0
            const metaHit = metaPct >= 100
            return (
              <div key={a.ownerId} className="pva-row" style={{ ...vars, opacity: isOtros ? 0.75 : 1 }}>
                <div className="pva-asesor-cell">
                  <AdvisorAvatar
                    name={a.nombre}
                    initials={initials(a.nombre)}
                    className="pva-avatar"
                    style={{
                      width: avatarSize, height: avatarSize,
                      color: accent, background: `${accent}24`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--sans)', fontWeight: 'bold', fontSize: avatarSize * 0.34,
                    }}
                  />
                  <span className="pva-asesor-name">{a.nombre}</span>
                </div>
                <div className="pva-metric-ventas">
                  <div className="pva-year-val">{fmtMXN(a.totalVentas)}</div>
                  {isOtros ? (
                    <div className="pva-meta-label">ya no están activos</div>
                  ) : (
                    <>
                      <div className="pva-mini-track">
                        <div className={`pva-mini-fill${metaHit ? ' hit' : ''}`} style={{ width: `${Math.min(100, metaPct)}%` }} />
                      </div>
                      <div className={`pva-meta-label${metaHit ? ' hit' : ''}`}>{metaPct}% de meta · {fmtCompact(a.metaPeriodo)}</div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {!visible.length && <div className="state-box">Sin ventas registradas este año</div>}
      </div>
    </div>
  )
}
