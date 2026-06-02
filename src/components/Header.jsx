import { useState, useEffect } from 'react'
import { isMockMode } from '../hooks/useData'
import styles from './Header.module.css'

function timeAgo(date) {
  if (!date) return ''
  const diff = Math.floor((Date.now() - new Date(date)) / 1000)
  if (diff < 60) return `hace ${diff}s`
  return `hace ${Math.floor(diff / 60)}min`
}

export default function Header({ lastUpdate, onRefreshNow, isRefreshingNow }) {
  const [ago, setAgo] = useState(timeAgo(lastUpdate))

  useEffect(() => {
    setAgo(timeAgo(lastUpdate))
    const t = setInterval(() => setAgo(timeAgo(lastUpdate)), 10_000)
    return () => clearInterval(t)
  }, [lastUpdate])

  const now = new Date()
  const fecha = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <div className={styles.logo}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="url(#lg)"/>
            <path d="M8 20L14 8L20 20" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 16.5H18" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
            <defs>
              <linearGradient id="lg" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                <stop stopColor="#4f8ef7"/>
                <stop offset="1" stopColor="#7c5ce8"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div>
          <h1 className={styles.title}>Ranking de Asesores</h1>
          <p className={styles.date}>{fecha}</p>
        </div>
      </div>
      <div className={styles.right}>
        {isMockMode && (
          <span className={styles.mockBadge}>Modo demo</span>
        )}
        <div className={styles.live}>
          <span className="live-dot" />
          <span className={styles.liveText}>
            {lastUpdate ? `Actualizado ${ago}` : 'En vivo'}
          </span>
        </div>
        {onRefreshNow && (
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={onRefreshNow}
            disabled={isRefreshingNow}
          >
            {isRefreshingNow ? 'Actualizando...' : 'Actualizar ahora'}
          </button>
        )}
      </div>
    </header>
  )
}
