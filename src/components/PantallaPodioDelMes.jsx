import { useRankingAsesores } from '../hooks/useData'
import AdvisorAvatar from './AdvisorAvatar'
import Car3D from './Car3D'

const MEDALS = ['🥇', '🥈', '🥉']
// Colores exactos del diseño (podio_del_mes.html) por puesto.
const RANK_COLORS = {
  1: { accent: '#FFD23F', dim: '#B8891C' },
  2: { accent: '#D9E4E6', dim: '#7C9298' },
  3: { accent: '#E08A45', dim: '#8C4F1E' },
}

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]

function initials(name = '') {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return name.substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const CSS = `
.ppm-card{ background:var(--s1); border:1px solid rgba(255,255,255,0.06); padding:16px 24px 0 24px; position:relative; overflow:hidden; }
.ppm-card::before, .ppm-card::after{ content:''; position:absolute; width:14px; height:14px; pointer-events:none; }
.ppm-card::before{ top:-1px; left:-1px; border-top:2px solid var(--cyan); border-left:2px solid var(--cyan); }
.ppm-card::after{ bottom:-1px; right:-1px; border-bottom:2px solid var(--cyan); border-right:2px solid var(--cyan); }
.ppm-card-title{ text-align:center; margin-bottom:4px; }
.ppm-card-title h2{ font-size:17px; font-weight:700; letter-spacing:0.01em; color:var(--text); }
.ppm-card-title h2::before{ content:'▸ '; color:var(--cyan); }
.ppm-card-title p{ font-size:11px; color:var(--muted); margin-top:3px; font-weight:500; letter-spacing:0.02em; }
.ppm-stage{ perspective:1400px; padding-top:8px; }
.ppm-podium{ display:flex; align-items:flex-end; justify-content:center; gap:32px; transform:rotateX(6deg); transform-style:preserve-3d; }
.ppm-slot{ display:flex; flex-direction:column; align-items:center; width:130px; }
.ppm-slot.p1{ order:2; }
.ppm-slot.p2{ order:1; }
.ppm-slot.p3{ order:3; }
.ppm-avatar{ border-radius:50%; background:#0d1416; margin-bottom:8px; position:relative; z-index:2; }
.ppm-slot.p1 .ppm-avatar{ width:64px; height:64px; font-size:22px; border:3px solid #FFD23F; box-shadow:0 0 26px rgba(255,210,63,0.55); }
.ppm-slot.p2 .ppm-avatar{ width:50px; height:50px; font-size:17px; border:3px solid #D9E4E6; box-shadow:0 0 20px rgba(217,228,230,0.45); }
.ppm-slot.p3 .ppm-avatar{ width:46px; height:46px; font-size:15px; border:3px solid #E08A45; box-shadow:0 0 18px rgba(224,138,69,0.4); }
.ppm-crown{ margin-bottom:4px; animation:ppmFloat 2.2s ease-in-out infinite; filter:drop-shadow(0 0 10px rgba(255,210,63,0.6)); }
.ppm-slot.p1 .ppm-crown{ font-size:26px; }
.ppm-slot.p2 .ppm-crown{ font-size:16px; filter:drop-shadow(0 0 8px rgba(217,228,230,0.55)); }
.ppm-slot.p3 .ppm-crown{ font-size:14px; filter:drop-shadow(0 0 8px rgba(224,138,69,0.5)); }
@keyframes ppmFloat{ 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-6px); } }
.ppm-car{ margin-bottom:5px; }
.ppm-slot.p1 .ppm-car{ width:150px; filter:drop-shadow(0 4px 10px rgba(255,210,63,0.4)); }
.ppm-slot.p2 .ppm-car{ width:116px; filter:drop-shadow(0 4px 8px rgba(217,228,230,0.35)); }
.ppm-slot.p3 .ppm-car{ width:100px; filter:drop-shadow(0 4px 8px rgba(224,138,69,0.3)); }
.ppm-name{ font-weight:700; font-size:12.5px; text-align:center; line-height:1.25; margin-bottom:3px; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; }
.ppm-slot.p1 .ppm-name{ font-size:14px; }
.ppm-value{ font-weight:800; font-size:12.5px; text-align:center; margin-bottom:10px; }
.ppm-slot.p1 .ppm-value{ color:#FFD23F; font-size:15.5px; text-shadow:0 0 14px rgba(255,210,63,0.4); }
.ppm-slot.p2 .ppm-value{ color:#D9E4E6; }
.ppm-slot.p3 .ppm-value{ color:#E08A45; }
.ppm-pillar{ position:relative; width:100%; transform-style:preserve-3d; animation:ppmRise 0.65s cubic-bezier(.2,1,.3,1) both; }
@keyframes ppmRise{ from{ transform:scaleY(0); opacity:0; } to{ transform:scaleY(1); opacity:1; } }
.ppm-front{ position:relative; width:100%; height:100%; display:flex; align-items:flex-start; justify-content:center; padding-top:9px; border-radius:6px 0 0 0; }
.ppm-front::before{ content:''; position:absolute; top:-11px; left:0; width:100%; height:11px; transform:skewX(-45deg); transform-origin:bottom left; }
.ppm-front::after{ content:''; position:absolute; top:0; right:-11px; width:11px; height:100%; transform:skewY(-45deg); transform-origin:top left; }
.ppm-rank{ font-weight:800; font-size:24px; position:relative; z-index:1; }
.ppm-slot.p1 .ppm-pillar{ height:90px; animation-delay:0.22s; }
.ppm-slot.p2 .ppm-pillar{ height:64px; animation-delay:0.05s; }
.ppm-slot.p3 .ppm-pillar{ height:48px; animation-delay:0.36s; }
.ppm-slot.p1 .ppm-front{ background:linear-gradient(180deg, #FFD23F, #B8891C); box-shadow:0 0 30px rgba(255,210,63,0.3); }
.ppm-slot.p1 .ppm-front::before{ background:#FFE9A8; }
.ppm-slot.p1 .ppm-front::after{ background:#7A5410; }
.ppm-slot.p1 .ppm-rank{ color:#3A2600; }
.ppm-slot.p2 .ppm-front{ background:linear-gradient(180deg, #D9E4E6, #7C9298); box-shadow:0 0 22px rgba(217,228,230,0.3); }
.ppm-slot.p2 .ppm-front::before{ background:#F2F8F9; }
.ppm-slot.p2 .ppm-front::after{ background:#4E6266; }
.ppm-slot.p2 .ppm-rank{ color:#1C2A2C; }
.ppm-slot.p3 .ppm-front{ background:linear-gradient(180deg, #E08A45, #8C4F1E); box-shadow:0 0 20px rgba(224,138,69,0.3); }
.ppm-slot.p3 .ppm-front::before{ background:#F2C093; }
.ppm-slot.p3 .ppm-front::after{ background:#5C300E; }
.ppm-slot.p3 .ppm-rank{ color:#3A1E08; }
.ppm-floor{ height:8px; margin:0 -24px; background:linear-gradient(90deg, transparent, rgba(0,255,214,0.12), transparent); border-top:1px solid rgba(255,255,255,0.08); }
.ppm-footer{ text-align:center; padding:8px 0 10px 0; font-size:10.5px; color:var(--dim); font-weight:500; letter-spacing:0.02em; }
@media (max-width:640px){
  .ppm-podium{ gap:14px; }
  .ppm-slot{ width:31%; }
  .ppm-slot.p1 .ppm-avatar{ width:54px; height:54px; font-size:18px; }
  .ppm-slot.p2 .ppm-avatar{ width:44px; height:44px; font-size:15px; }
  .ppm-slot.p3 .ppm-avatar{ width:40px; height:40px; font-size:13px; }
  .ppm-name{ font-size:11px; white-space:normal; overflow:visible; text-overflow:clip; }
  .ppm-slot.p1 .ppm-name{ font-size:12px; }
  .ppm-value{ font-size:11px; }
  .ppm-slot.p1 .ppm-value{ font-size:13px; }
  .ppm-slot.p1 .ppm-car{ width:100%; max-width:110px; }
  .ppm-slot.p2 .ppm-car{ width:100%; max-width:86px; }
  .ppm-slot.p3 .ppm-car{ width:100%; max-width:76px; }
}
`

export default function PantallaPodioDelMes({ tvMode = false }) {
  const mesQ = useRankingAsesores('mensual', 60 * 60_000)
  const ranking = mesQ.data?.ranking || []

  if (mesQ.isLoading) return <div className="state-box" style={{ paddingTop: 60 }}>Cargando pantalla…</div>
  // Con datos previos, un fallo del refresco en segundo plano no debe tapar la
  // pantalla — se sigue mostrando lo último que cargó bien.
  if (mesQ.isError && !mesQ.data) return <div className="state-box" style={{ paddingTop: 60, color: 'var(--red-w)' }}>Error: {mesQ.error?.message}</div>

  const top3 = ranking
    .filter(a => a.nombre !== 'Sin asesor asignado')
    .slice(0, 3)
    .map((a, i) => ({ ...a, rank: i + 1 }))

  const now = new Date()
  // En TV el kiosco no puede hacer scroll (pantalla-kiosk usa overflow:hidden):
  // si el podio se pasa del alto de pantalla, el piso/número del pilar y el
  // footer quedan cortados sin avisar. Se mantiene compacto con margen de sobra.
  const carHeight = tvMode ? 80 : 90

  return (
    <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <style>{CSS}</style>
      <div className="ppm-card">
        <div className="ppm-card-title">
          <h2>Top 3 Asesores</h2>
          <p>RANKING DE VENTAS · {MESES[now.getMonth()]} {now.getFullYear()}</p>
        </div>

        <div className="ppm-stage">
          <div className="ppm-podium">
            {top3.map(a => {
              const colors = RANK_COLORS[a.rank]
              return (
                <div key={a.ownerId} className={`ppm-slot p${a.rank}`}>
                  <div className="ppm-crown">👑</div>
                  <AdvisorAvatar
                    name={a.nombre}
                    initials={initials(a.nombre)}
                    className="ppm-avatar"
                    style={{
                      color: '#04110D', fontWeight: 700,
                      background: `linear-gradient(135deg, ${colors.accent}, ${colors.dim})`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--sans)',
                    }}
                  />
                  <div className="ppm-name">{a.nombre}</div>
                  <div className="ppm-value">{MEDALS[a.rank - 1]} ${(a.totalVentas || 0).toLocaleString()}</div>
                  <div className="ppm-car">
                    <Car3D color={colors.accent} height={carHeight} />
                  </div>
                  <div className="ppm-pillar">
                    <div className="ppm-front"><div className="ppm-rank">{a.rank}</div></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="ppm-floor" />
        <div className="ppm-footer">Datos actualizados en tiempo real · Díaz Lara Contabilidad</div>

        {!top3.length && <div className="state-box">Sin ventas registradas este mes</div>}
      </div>
    </div>
  )
}
