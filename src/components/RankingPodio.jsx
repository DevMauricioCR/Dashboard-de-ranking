import styles from './RankingPodio.module.css'

const fmt = n => new Intl.NumberFormat('es-MX').format(n)
const fmtM = n => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`
  return `$${n}`
}

function initials(nombre) {
  return nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const AVATAR_COLORS = [
  ['#4f8ef7','#1a3a6e'],
  ['#7c5ce8','#2d1e6e'],
  ['#34d399','#0e4a33'],
  ['#fbbf24','#5a3e00'],
  ['#f87171','#5a1a1a'],
  ['#60a5fa','#1a3560'],
  ['#a78bfa','#3b1f6e'],
  ['#fb923c','#5a2a00'],
]

function avatarStyle(idx) {
  const [fg, bg] = AVATAR_COLORS[idx % AVATAR_COLORS.length]
  return { background: bg, color: fg, borderColor: fg + '55' }
}

function trendBadge(t) {
  const n = Number(t)
  if (n > 0) return <span className="badge badge-up">▲ {n}</span>
  if (n < 0) return <span className="badge badge-down">▼ {Math.abs(n)}</span>
  return <span className="badge badge-neu">— igual</span>
}

function PodioCard({ asesor, position, idx }) {
  const heights = { 1: 130, 2: 100, 3: 80 }
  const medals  = { 1: '🥇', 2: '🥈', 3: '🥉' }
  const order   = { 1: 2, 2: 1, 3: 3 }

  return (
    <div className={styles.podioCard} style={{ order: order[position] }}>
      <div className={`avatar ${styles.podioAvatar}`} style={avatarStyle(idx)}>
        {initials(asesor.nombre)}
      </div>
      <p className={styles.podioNombre}>{asesor.nombre.split(' ')[0]}</p>
      <p className={styles.podioApellido}>{asesor.nombre.split(' ').slice(1).join(' ')}</p>
      <div className={styles.podioStats}>
        <span className={styles.podioDeals}>{asesor.deals} negocios</span>
        <span className={styles.podioMonto}>{fmtM(asesor.monto)}</span>
      </div>
      <div className={styles.podioBase} style={{ height: heights[position] }}>
        <span className={styles.podioMedal}>{medals[position]}</span>
        <span className={styles.podioRank}>#{position}</span>
      </div>
    </div>
  )
}

function SkeletonRow() {
  return (
    <tr className={styles.row}>
      <td><div className={`skeleton ${styles.skSm}`} /></td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className={`skeleton ${styles.skAvatar}`} />
          <div className={`skeleton ${styles.skMd}`} />
        </div>
      </td>
      <td><div className={`skeleton ${styles.skSm}`} /></td>
      <td><div className={`skeleton ${styles.skSm}`} /></td>
      <td><div className={`skeleton ${styles.skMd}`} /></td>
      <td><div className={`skeleton ${styles.skSm}`} /></td>
    </tr>
  )
}

export default function RankingPodio({ data, isLoading, onSelectAsesor, selectedAsesor }) {
  if (isLoading) return (
    <div className="card">
      <p className="card-title">Ranking de asesores</p>
      <div className={styles.podioWrap}>
        {[1,2,3].map(i => (
          <div key={i} className={styles.podioCard}>
            <div className={`skeleton ${styles.skAvatar}`} style={{ width:56, height:56, borderRadius:'50%' }} />
            <div className={`skeleton ${styles.skMd}`} style={{ margin:'8px auto 4px' }} />
            <div className={`skeleton`} style={{ width:60,height:10,borderRadius:4,margin:'0 auto 12px' }} />
            <div className={`skeleton`} style={{ width:'100%', height:80, borderRadius:'var(--r-md)' }} />
          </div>
        ))}
      </div>
      <table className={styles.table}><tbody>{[...Array(5)].map((_,i)=><SkeletonRow key={i}/>)}</tbody></table>
    </div>
  )

  if (!data?.length) return null

  const top3 = data.slice(0, 3)
  const rest  = data.slice(3)

  return (
    <div className="card">
      <div className={styles.titleRow}>
        <p className="card-title" style={{ marginBottom: 0 }}>Ranking de asesores</p>
        {selectedAsesor && (
          <button className={styles.clearBtn} onClick={() => onSelectAsesor(null)}>
            × Limpiar filtro
          </button>
        )}
      </div>

      {/* Podio top 3 */}
      <div className={styles.podioWrap}>
        {top3.map((a, i) => (
          <PodioCard key={a.ownerId} asesor={a} position={i + 1} idx={i} />
        ))}
      </div>

      {/* Tabla resto */}
      {rest.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Asesor</th>
              <th>Leads</th>
              <th>Negocios</th>
              <th>Monto</th>
              <th>Tend.</th>
            </tr>
          </thead>
          <tbody>
            {rest.map((a, i) => (
              <tr
                key={a.ownerId}
                className={`${styles.row} ${selectedAsesor === a.ownerId ? styles.selected : ''}`}
                onClick={() => onSelectAsesor(selectedAsesor === a.ownerId ? null : a.ownerId)}
              >
                <td className={styles.rank}>{a.rank}</td>
                <td>
                  <div className={styles.nameCell}>
                    <div className="avatar" style={{ ...avatarStyle(i + 3), width: 32, height: 32, fontSize: 11 }}>
                      {initials(a.nombre)}
                    </div>
                    <span className={styles.nombre}>{a.nombre}</span>
                  </div>
                </td>
                <td className={styles.num}>{fmt(a.leadsContactados)}</td>
                <td className={styles.num}>{fmt(a.deals)}</td>
                <td className={styles.monto}>{fmtM(a.monto)}</td>
                <td>{trendBadge(a.tendencia)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
