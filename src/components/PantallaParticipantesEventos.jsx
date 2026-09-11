import { useEventosParticipantes } from '../hooks/useData'

const fmtInt = n => new Intl.NumberFormat('es-MX').format(n || 0)

// Layout exacto del diseño (participantes_eventos.html)
const CSS = `
.pev-card{ background:var(--s1); border:1px solid rgba(255,255,255,0.06); padding:24px; position:relative; }
.pev-card::before, .pev-card::after{ content:''; position:absolute; width:14px; height:14px; pointer-events:none; }
.pev-card::before{ top:-1px; left:-1px; border-top:2px solid var(--cyan); border-left:2px solid var(--cyan); }
.pev-card::after{ bottom:-1px; right:-1px; border-bottom:2px solid var(--cyan); border-right:2px solid var(--cyan); }
.pev-card-title{ display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; padding-bottom:14px; border-bottom:1px solid rgba(255,255,255,0.06); }
.pev-card-title h2{ font-size:16px; font-weight:700; color:var(--text); }
.pev-card-title h2::before{ content:'▸ '; color:var(--cyan); }
.pev-card-title span{ font-size:11.5px; color:var(--muted); font-weight:600; letter-spacing:0.03em; }
.pev-kpi{ padding:22px 28px; margin-bottom:16px; background:linear-gradient(135deg, rgba(0,255,214,0.08), rgba(255,46,126,0.04)); border-color:rgba(0,255,214,0.3); }
.pev-kpi-label{ font-size:11.5px; color:var(--muted); text-transform:uppercase; letter-spacing:0.09em; font-weight:700; }
.pev-kpi-value{ font-weight:700; font-size:30px; letter-spacing:-0.01em; color:var(--cyan); text-shadow:0 0 18px rgba(0,255,214,0.35); margin-top:6px; }
.pev-table{ width:100%; border-collapse:collapse; }
.pev-table th{ text-align:left; font-size:11.5px; text-transform:uppercase; letter-spacing:0.06em; color:var(--muted); font-weight:700; padding:0 14px 14px 14px; }
.pev-table th.num{ text-align:right; }
.pev-table td{ padding:16px 14px; font-size:14px; border-top:1px solid rgba(255,255,255,0.06); vertical-align:top; color:var(--text); }
.pev-table tr:hover td{ background:rgba(0,255,214,0.02); }
.pev-evento-name{ font-weight:700; font-size:14.5px; color:var(--text); }
.pev-table td.num{ text-align:right; }
.pev-count-big{ font-size:22px; font-weight:800; color:var(--cyan); }
@media (max-width:700px){
  .pev-table, .pev-table thead, .pev-table tbody, .pev-table th, .pev-table td, .pev-table tr{ display:block; }
  .pev-table thead{ display:none; }
  .pev-table tr{ border-top:1px solid rgba(255,255,255,0.06); padding:14px 0; }
  .pev-table td{ border:none; padding:4px 0; }
}
`

export default function PantallaParticipantesEventos({ tvMode = false }) {
  const eventosQ = useEventosParticipantes()
  const eventos = eventosQ.data || []
  const totalParticipantes = eventos.reduce((s, ev) => s + (ev.participantes || 0), 0)

  if (eventosQ.isLoading) return <div className="state-box" style={{ paddingTop: 60 }}>Cargando pantalla…</div>
  // Con datos previos, un fallo del refresco en segundo plano no debe tapar la
  // pantalla — se sigue mostrando lo último que cargó bien.
  if (eventosQ.isError && !eventosQ.data) return <div className="state-box" style={{ paddingTop: 60, color: 'var(--red-w)' }}>Error: {eventosQ.error?.message}</div>

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <style>{CSS}</style>
      {Boolean(eventos.length) && (
        <div className="pev-card pev-kpi">
          <div className="pev-kpi-label">// Total de asistentes</div>
          <div className="pev-kpi-value">{fmtInt(totalParticipantes)}</div>
        </div>
      )}
      <div className="pev-card">
        <div className="pev-card-title">
          <h2>Eventos</h2>
          <span>{eventos.length} EVENTOS</span>
        </div>
        <table className="pev-table">
          <colgroup>
            <col style={{ width: '60%' }} />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th style={{ fontSize: tvMode ? 14 : 11.5 }}>EVENTO</th>
              <th className="num" style={{ fontSize: tvMode ? 14 : 11.5 }}>PARTICIPANTES</th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((ev, i) => (
              <tr key={`${ev.hoja}-${i}`}>
                <td>
                  <div className="pev-evento-name" style={{ fontSize: tvMode ? 17 : 14.5 }}>{ev.hoja}</div>
                </td>
                <td className="num">
                  <span className="pev-count-big" style={{ fontSize: tvMode ? 28 : 22 }}>{ev.participantes}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!eventos.length && <div className="state-box">Sin eventos registrados</div>}
      </div>
    </div>
  )
}
