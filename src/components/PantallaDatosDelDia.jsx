import { useMemo } from 'react'
import { useRankingAsesores, useVentasWeb } from '../hooks/useData'
import useRowFit from '../hooks/useRowFit'
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

const ROW_COLUMNS = '36px 1fr 90px 100px 100px minmax(140px, 26%) 110px'

const CSS = `
.pdd-screen{ height:100%; overflow:auto; display:flex; flex-direction:column; gap:8px; }
.pdd-card{ background:var(--s1); border:1px solid rgba(255,255,255,0.06); padding:18px; position:relative; }
.pdd-card::before, .pdd-card::after{ content:''; position:absolute; width:14px; height:14px; pointer-events:none; }
.pdd-card::before{ top:-1px; left:-1px; border-top:2px solid var(--cyan); border-left:2px solid var(--cyan); }
.pdd-card::after{ bottom:-1px; right:-1px; border-bottom:2px solid var(--cyan); border-right:2px solid var(--cyan); }
.pdd-table-card{ display:flex; flex-direction:column; }
.pdd-table-card.pdd-fit{ flex:1; min-height:0; }
.pdd-kpi{ padding:10px 18px; margin-bottom:8px; background:linear-gradient(135deg, rgba(0,255,214,0.08), rgba(255,46,126,0.04)); border-color:rgba(0,255,214,0.3); display:flex; gap:16px; flex-wrap:nowrap; flex-shrink:0; }
.pdd-kpi > div{ flex:1 1 0; min-width:0; }
.pdd-kpi-label{ font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:0.06em; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pdd-kpi-value{ font-weight:700; font-size:20px; letter-spacing:-0.01em; color:var(--cyan); text-shadow:0 0 18px rgba(0,255,214,0.35); margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pdd-card-title{ display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.06); flex-shrink:0; }
.pdd-card-title h2{ font-size:16px; font-weight:700; color:var(--text); }
.pdd-card-title h2::before{ content:'▸ '; color:var(--cyan); }
.pdd-card-title span{ font-size:11.5px; color:var(--muted); font-weight:600; letter-spacing:0.03em; }
.pdd-col-heads{ display:grid; grid-template-columns:${ROW_COLUMNS}; gap:12px; padding:0 12px 6px 12px; font-size:11.5px; font-weight:700; letter-spacing:0.06em; color:var(--muted); text-transform:uppercase; flex-shrink:0; }
.pdd-col-heads .num{ text-align:right; }
.pdd-rows{ display:flex; flex-direction:column; gap:calc(2px * var(--row-scale, 1)); }
.pdd-rows.pdd-fit{ flex:1; min-height:0; overflow:hidden; }
.pdd-row{ display:grid; grid-template-columns:${ROW_COLUMNS}; align-items:center; gap:12px; padding:calc(6px * var(--row-scale, 1)) 12px; border-top:1px solid rgba(255,255,255,0.06); overflow:hidden; transition:background .12s; }
.pdd-rows.pdd-fit .pdd-row{ flex:1 1 0; min-height:0; }
.pdd-row:hover{ background:rgba(0,255,214,0.02); }
.pdd-rank{ font-weight:700; font-size:calc(14px * var(--row-scale, 1)); color:var(--muted); }
.pdd-asesor-cell{ display:flex; align-items:center; gap:12px; min-width:0; }
.pdd-avatar{ border-radius:50%; flex-shrink:0; border:1.5px solid var(--c); box-shadow:0 0 8px var(--c-glow); background:#0d1416; }
.pdd-asesor-name{ font-weight:700; font-size:calc(14.5px * var(--row-scale, 1)); color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pdd-num{ text-align:right; color:var(--muted); font-weight:500; font-size:calc(14.5px * var(--row-scale, 1)); }
.pdd-num.total{ color:var(--c); font-weight:700; font-size:calc(15px * var(--row-scale, 1)); }
.pdd-meta-cell{ display:flex; flex-direction:column; gap:6px; min-width:0; }
.pdd-mini-track{ height:4px; width:100%; background:rgba(255,255,255,0.06); border-radius:3px; overflow:hidden; }
.pdd-mini-fill{ height:100%; border-radius:3px; background:var(--c); box-shadow:0 0 6px var(--c-glow); transform-origin:right; transition:width .8s cubic-bezier(0.16,1,0.3,1); }
.pdd-mini-fill.hit{ background:var(--amber); box-shadow:0 0 8px rgba(255,184,0,0.6); }
.pdd-meta-label{ font-size:calc(10.5px * var(--row-scale, 1)); text-align:right; color:var(--dim); }
.pdd-meta-label.hit{ color:var(--amber); font-weight:700; }
.pdd-web-icon{ border-radius:50%; flex-shrink:0; border:1.5px solid var(--c); box-shadow:0 0 8px var(--c-glow); background:#0d1416; display:flex; align-items:center; justify-content:center; }
.pdd-row.web-row{ opacity:0.85; }
@media (max-width:900px){
  .pdd-table-card.pdd-fit{ flex:none; }
  .pdd-col-heads .c3, .pdd-col-heads .c4, .pdd-col-heads .c5,
  .pdd-row .c3, .pdd-row .c4, .pdd-row .c5{ display:none; }
  .pdd-col-heads{ grid-template-columns:36px 1fr minmax(140px, 26%) 110px; }
  .pdd-rows.pdd-fit{ flex:none; overflow:visible; }
  .pdd-rows.pdd-fit .pdd-row{ flex:none; }
  .pdd-row{ grid-template-columns:36px 1fr minmax(140px, 26%) 110px; }
  .pdd-meta-cell{ min-width:100px; }
}
@media (max-width:480px){
  /* A este ancho ya no cabe ni la columna de SHARE (barra + meta) junto con
     asesor y total -- se ocultaba el contenido sin scroll (overflow-x:hidden
     global) en vez de recortarlo con una barra, así que mejor quitarla. */
  .pdd-col-heads .c6, .pdd-row .c6{ display:none; }
  .pdd-col-heads{ grid-template-columns:36px 1fr 110px; }
  .pdd-row{ grid-template-columns:36px 1fr 110px; }
  .pdd-asesor-name{ font-size:13px; }
}
@media (max-width:768px){
  /* El nowrap de .pdd-kpi es para que quepa en una sola línea en el kiosco
     de TV (pantalla ancha, sin scroll); en celular sí hay scroll, así que
     mejor dejar que cada KPI se lea completo en vez de truncarlo. */
  .pdd-kpi{ flex-wrap:wrap; gap:16px 28px; }
  .pdd-kpi > div{ flex:1 1 40%; }
  .pdd-kpi-label, .pdd-kpi-value{ white-space:normal; overflow:visible; text-overflow:clip; }
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

  // En TV (kiosco sin scroll) las filas se encogen o agrandan automáticamente
  // según cuántos asesores haya y el alto disponible, para que siempre quepan
  // todas sin cortarse -- ver useRowFit.
  const rowCountForFit = ranking.filter(a => a.nombre !== 'Sin asesor asignado').length + (ventasWeb ? 1 : 0)
  const { containerRef: rowsRef, scale: rowScale } = useRowFit(rowCountForFit, tvMode)

  if (diaQ.isLoading) return <div className="state-box" style={{ paddingTop: 60 }}>Cargando pantalla…</div>
  // Si ya había datos de una carga anterior, un fallo del refresco en segundo plano
  // no debe tapar la pantalla con el error — se sigue mostrando lo último que cargó
  // bien. Solo se muestra el error si nunca hubo datos.
  if (diaQ.isError && !diaQ.data) return <div className="state-box" style={{ paddingTop: 60, color: 'var(--red-w)' }}>Error: {diaQ.error?.message}</div>

  const visible = ranking.filter(a => a.nombre !== 'Sin asesor asignado')
  const avatarSize = tvMode ? Math.round(36 * rowScale) : 36
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
    <div className="pdd-screen">
      <style>{CSS}</style>
      <div className="pdd-card pdd-kpi">
        <div>
          <div className="pdd-kpi-label">// Ventas hoy</div>
          <div className="pdd-kpi-value">{fmtMXN(ventasTotalesDia)}</div>
        </div>
        {embudo && (
          <div>
            <div className="pdd-kpi-label">// Negocio total</div>
            <div className="pdd-kpi-value">{fmtMXN(embudo.cantidadTotal)}</div>
          </div>
        )}
        {embudo && (
          <div>
            <div className="pdd-kpi-label">// Negocio ponderado</div>
            <div className="pdd-kpi-value">{fmtMXN(embudo.cantidadPonderada)}</div>
          </div>
        )}
        {embudo && (
          <div>
            <div className="pdd-kpi-label">// Negocio abierto</div>
            <div className="pdd-kpi-value">{fmtMXN(embudo.cantidadAbierta)}</div>
          </div>
        )}
        {embudo && (
          <div>
            <div className="pdd-kpi-label">// Negocio nuevo</div>
            <div className="pdd-kpi-value">{fmtMXN(embudo.cantidadNuevoNegocio)}</div>
          </div>
        )}
      </div>
      <div className={`pdd-card pdd-table-card${tvMode ? ' pdd-fit' : ''}`}>
        <div className="pdd-card-title">
          <h2>Resumen por Asesor</h2>
          <span>{visible.length} ASESORES</span>
        </div>
        <div className="pdd-col-heads">
          <span>#</span>
          <span>ASESOR</span>
          <span className="num c3">LLAMADAS</span>
          <span className="num c4">INTERESADOS</span>
          <span className="num c5">PROMESAS</span>
          <span className="num c6">SHARE</span>
          <span className="num">TOTAL</span>
        </div>
        <div className={`pdd-rows${tvMode ? ' pdd-fit' : ''}`} ref={rowsRef} style={{ '--row-scale': tvMode ? rowScale : 1 }}>
          {rankedRows.map((a, i) => {
            const isWeb = a.kind === 'web'
            const accent = isWeb ? '#4FD1FF' : PALETTE[i % PALETTE.length]
            const vars = colorVars(accent)
            const metaPct = a.avanceMetaPct || 0
            const metaHit = metaPct >= 100
            return (
              <div key={a.ownerId} className={`pdd-row${isWeb ? ' web-row' : ''}`} style={vars}>
                <div className="pdd-rank">{i + 1}</div>
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
                  <span className="pdd-asesor-name">{a.nombre}</span>
                </div>
                <div className="pdd-num c3">{isWeb ? '—' : fmtInt(a.totalLlamadas)}</div>
                <div className="pdd-num c4">{isWeb ? '—' : fmtInt(getEmbudoCount(embudoByAdvisor, a, 'interesados'))}</div>
                <div className="pdd-num c5">{isWeb ? '—' : fmtInt(getEmbudoCount(embudoByAdvisor, a, 'promesas'))}</div>
                <div className="c6">
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
                </div>
                <div className="pdd-num total">${(a.totalVentas || 0).toLocaleString()}</div>
              </div>
            )
          })}
        </div>
        {!visible.length && <div className="state-box">Sin ventas registradas hoy</div>}
      </div>
    </div>
  )
}
