import styles from './KpiCards.module.css'

const fmt = n => new Intl.NumberFormat('es-MX').format(n)
const fmtMoney = n => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

function KpiCard({ icon, label, value, sub, color }) {
  return (
    <div className={styles.card} style={{ '--accent-local': color }}>
      <div className={styles.iconWrap}>
        <span className={styles.icon}>{icon}</span>
      </div>
      <p className={styles.label}>{label}</p>
      <p className={styles.value}>{value}</p>
      {sub && <p className={styles.sub}>{sub}</p>}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className={styles.card}>
      <div className={`skeleton ${styles.skIcon}`} />
      <div className={`skeleton ${styles.skLabel}`} />
      <div className={`skeleton ${styles.skValue}`} />
    </div>
  )
}

export default function KpiCards({ data, isLoading }) {
  if (isLoading) return (
    <div className={styles.grid}>
      {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
    </div>
  )
  if (!data) return null

  const cards = [
    {
      icon: '📞',
      label: 'Leads contactados hoy',
      value: fmt(data.totalLeadsHoy),
      sub: 'llamadas registradas',
      color: '#4f8ef7',
    },
    {
      icon: '🏆',
      label: 'Negocios cerrados',
      value: fmt(data.negociosMes),
      sub: 'este mes',
      color: '#e8b84b',
    },
    {
      icon: '💰',
      label: 'Monto total',
      value: fmtMoney(data.montoMes),
      sub: 'acumulado del mes',
      color: '#34d399',
    },
    {
      icon: '⭐',
      label: 'Asesor del día',
      value: data.asesorDelDia,
      sub: 'más negocios hoy',
      color: '#7c5ce8',
    },
  ]

  return (
    <div className={styles.grid}>
      {cards.map(c => <KpiCard key={c.label} {...c} />)}
    </div>
  )
}
