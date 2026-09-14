import { useEventosParticipantes } from '../hooks/useData'
import useRowFit from '../hooks/useRowFit'

const fmtInt = n => new Intl.NumberFormat('es-MX').format(n || 0)

// Layout exacto del diseño (participantes_eventos.html)
const CSS = `
.pev-screen{ height:100%; overflow:auto; display:flex; flex-direction:column; gap:8px; }
.pev-card{ background:var(--s1); border:1px solid rgba(255,255,255,0.06); padding:18px; position:relative; }
.pev-card::before, .pev-card::after{ content:''; position:absolute; width:14px; height:14px; pointer-events:none; }
.pev-card::before{ top:-1px; left:-1px; border-top:2px solid var(--cyan); border-left:2px solid var(--cyan); }
.pev-card::after{ bottom:-1px; right:-1px; border-bottom:2px solid var(--cyan); border-right:2px solid var(--cyan); }
.pev-table-card{ display:flex; flex-direction:column; }
.pev-table-card.pev-fit{ flex:1; min-height:0; }
.pev-card-title{ display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.06); flex-shrink:0; }
.pev-card-title h2{ font-size:16px; font-weight:700; color:var(--text); }
.pev-card-title h2::before{ content:'▸ '; color:var(--cyan); }
.pev-card-title span{ font-size:11.5px; color:var(--muted); font-weight:600; letter-spacing:0.03em; }
.pev-kpi{ padding:12px 22px; margin-bottom:8px; background:linear-gradient(135deg, rgba(0,255,214,0.08), rgba(255,46,126,0.04)); border-color:rgba(0,255,214,0.3); flex-shrink:0; }
.pev-kpi-label{ font-size:11.5px; color:var(--muted); text-transform:uppercase; letter-spacing:0.09em; font-weight:700; }
.pev-kpi-value{ font-weight:700; font-size:23px; letter-spacing:-0.01em; color:var(--cyan); text-shadow:0 0 18px rgba(0,255,214,0.35); margin-top:4px; }
.pev-col-heads{ display:grid; grid-template-columns:60% 1fr; gap:14px; padding:0 14px 6px 14px; font-size:11.5px; font-weight:700; letter-spacing:0.06em; color:var(--muted); text-transform:uppercase; flex-shrink:0; }
.pev-col-heads .num{ text-align:right; }
.pev-rows{ display:flex; flex-direction:column; gap:calc(2px * var(--row-scale, 1)); }
.pev-rows.pev-fit{ flex:1; min-height:0; overflow:hidden; }
.pev-row{ display:grid; grid-template-columns:60% 1fr; align-items:center; gap:14px; padding:calc(7px * var(--row-scale, 1)) 14px; border-top:1px solid rgba(255,255,255,0.06); overflow:hidden; transition:background .12s; }
.pev-rows.pev-fit .pev-row{ flex:1 1 0; min-height:0; }
.pev-row:hover{ background:rgba(0,255,214,0.02); }
.pev-evento-name{ font-weight:700; font-size:calc(14.5px * var(--row-scale, 1)); color:var(--text); min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pev-num{ text-align:right; min-width:0; }
.pev-count-big{ font-size:calc(19px * var(--row-scale, 1)); font-weight:800; color:var(--cyan); }
@media (max-width:700px){
  .pev-table-card.pev-fit{ flex:none; }
  .pev-col-heads{ display:none; }
  .pev-rows.pev-fit{ flex:none; overflow:visible; }
  .pev-rows.pev-fit .pev-row{ flex:none; }
  .pev-row{ grid-template-columns:1fr auto; padding:14px 0; border-top:1px solid rgba(255,255,255,0.06); }
}
`

export default function PantallaParticipantesEventos({ tvMode = false }) {
  const eventosQ = useEventosParticipantes()
  const eventos = eventosQ.data || []
  const totalParticipantes = eventos.reduce((s, ev) => s + (ev.participantes || 0), 0)

  // En TV (kiosco sin scroll) las filas se encogen o agrandan automáticamente
  // según cuántos eventos haya y el alto disponible, para que siempre quepan
  // todos sin cortarse -- ver useRowFit.
  const { containerRef: rowsRef, scale: rowScale } = useRowFit(eventos.length, tvMode)

  if (eventosQ.isLoading) return <div className="state-box" style={{ paddingTop: 60 }}>Cargando pantalla…</div>
  // Con datos previos, un fallo del refresco en segundo plano no debe tapar la
  // pantalla — se sigue mostrando lo último que cargó bien.
  if (eventosQ.isError && !eventosQ.data) return <div className="state-box" style={{ paddingTop: 60, color: 'var(--red-w)' }}>Error: {eventosQ.error?.message}</div>

  return (
    <div className="pev-screen">
      <style>{CSS}</style>
      {Boolean(eventos.length) && (
        <div className="pev-card pev-kpi">
          <div className="pev-kpi-label">// Total de asistentes</div>
          <div className="pev-kpi-value">{fmtInt(totalParticipantes)}</div>
        </div>
      )}
      <div className={`pev-card pev-table-card${tvMode ? ' pev-fit' : ''}`}>
        <div className="pev-card-title">
          <h2>Eventos</h2>
          <span>{eventos.length} EVENTOS</span>
        </div>
        <div className="pev-col-heads">
          <span>EVENTO</span>
          <span className="num">PARTICIPANTES</span>
        </div>
        <div className={`pev-rows${tvMode ? ' pev-fit' : ''}`} ref={rowsRef} style={{ '--row-scale': tvMode ? rowScale : 1 }}>
          {eventos.map((ev, i) => (
            <div className="pev-row" key={`${ev.hoja}-${i}`}>
              <div className="pev-evento-name">{ev.hoja}</div>
              <div className="pev-num">
                <span className="pev-count-big">{ev.participantes}</span>
              </div>
            </div>
          ))}
        </div>
        {!eventos.length && <div className="state-box">Sin eventos registrados</div>}
      </div>
    </div>
  )
}
