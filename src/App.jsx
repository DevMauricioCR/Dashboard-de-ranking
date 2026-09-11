import { useState, useEffect } from 'react'
import { useQueryClient, useIsFetching } from '@tanstack/react-query'
import { useRankingAsesores, refreshDatasetNow } from './hooks/useData'
import Wallboard from './components/Wallboard'
import VistaAjustes from './components/VistaAjustes'
import PantallaDatosDelDia from './components/PantallaDatosDelDia'
import PantallaDatosDelMes from './components/PantallaDatosDelMes'
import PantallaVentasPorAno from './components/PantallaVentasPorAno'
import PantallaPodioDelMes from './components/PantallaPodioDelMes'
import PantallaParticipantesEventos from './components/PantallaParticipantesEventos'

function timeAgo(date) {
  if (!date) return null
  const diff = Math.floor((Date.now() - new Date(date)) / 1000)
  if (diff < 60) return `hace ${diff}s`
  return `hace ${Math.floor(diff / 60)}min`
}

const NAV = [
  {
    tip: 'Datos del Día',
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="4" y="10" width="4" height="10" rx="1"/>
        <rect x="10" y="4" width="4" height="16" rx="1"/>
        <rect x="16" y="7" width="4" height="13" rx="1"/>
      </svg>
    ),
  },
  {
    tip: 'Datos del Mes',
    icon: (
      <svg viewBox="0 0 24 24">
        <polyline points="3 17 9 11 13 15 21 7"/>
        <polyline points="14 7 21 7 21 14"/>
      </svg>
    ),
  },
  {
    tip: 'Ventas por Año',
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="17" rx="2"/>
        <line x1="3" y1="9" x2="21" y2="9"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
      </svg>
    ),
  },
  {
    tip: 'Podio del Mes',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M8 21h8"/>
        <path d="M12 17v4"/>
        <path d="M7 4h10l-1.5 8h-7z"/>
        <path d="M5 6H3.5A1.5 1.5 0 0 0 2 7.5v0A3.5 3.5 0 0 0 5.5 11H7"/>
        <path d="M19 6h1.5A1.5 1.5 0 0 1 22 7.5v0A3.5 3.5 0 0 1 18.5 11H17"/>
      </svg>
    ),
  },
  {
    tip: 'Participantes por Evento',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
]

// Cada pantalla vive en su propio nav, y también se puede abrir suelta (sin
// sidebar/topbar) para proyectarla en una TV vía ?view=<kiosk>.
const VIEW_NAMES = ['Datos del Día', 'Datos del Mes', 'Ventas por Año', 'Podio del Mes', 'Participantes por Evento']
const TV_ROTATION_MS = 30_000

const KIOSK_VIEWS = {
  'pantalla-dia': PantallaDatosDelDia,
  'pantalla-mes': PantallaDatosDelMes,
  'pantalla-anio': PantallaVentasPorAno,
  'pantalla-podio': PantallaPodioDelMes,
  'pantalla-eventos': PantallaParticipantesEventos,
}

export default function App() {
  const [activeNav, setActiveNav]       = useState(0)
  const [isRefreshingNow, setIsRefreshingNow] = useState(false)
  const [ago, setAgo]                   = useState(null)
  const [tvMode, setTvMode]             = useState(false)
  const [viewKey, setViewKey]           = useState(0)
  const [showAjustes, setShowAjustes]       = useState(false)
  // Este poll de 'mensual' solo alimenta el reloj "Actualizado hace Xs" del topbar
  // (visible sin importar qué pantalla estés viendo) -- no necesita ser más frecuente
  // que el refresco propio de las pantallas de Mes (1h), y pedirlo aparte cada minuto
  // duplicaba carga contra HubSpot de fondo incluso en Día/Eventos/Año.
  const [refreshInterval, setRefreshInterval] = useState(
    Number(import.meta.env.VITE_REFRESH_INTERVAL || 60 * 60_000)
  )

  const searchParams = new URLSearchParams(window.location.search)
  const isWallboard = window.location.pathname === '/pantalla' || searchParams.get('view') === 'pantalla'
  const kioskView = searchParams.get('view')
  const KioskComponent = kioskView ? KIOSK_VIEWS[kioskView] : null

  const queryClient = useQueryClient()
  const mensual = useRankingAsesores('mensual', refreshInterval)
  const isFetchingData = useIsFetching({ queryKey: ['hubspot-deals-dataset'] }) > 0

  const lastUpdate = mensual.dataUpdatedAt

  useEffect(() => {
    setAgo(timeAgo(lastUpdate))
    const t = setInterval(() => setAgo(timeAgo(lastUpdate)), 10_000)
    return () => clearInterval(t)
  }, [lastUpdate])

  const toggleTV = () => {
    setTvMode(on => {
      if (!on) {
        setViewKey(k => k + 1)
        document.documentElement.requestFullscreen?.().catch(() => {})
      } else {
        document.exitFullscreen?.().catch(() => {})
      }
      return !on
    })
  }

  const selectView = index => {
    setActiveNav(index)
    setShowAjustes(false)
    setViewKey(key => key + 1)
  }

  // Exit TV on Escape
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && tvMode) setTvMode(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tvMode])

  // Modo TV rota automáticamente entre las 5 pantallas -- la TV queda desatendida
  // proyectando, así que no tiene caso que se quede fija en la que estuviera abierta
  // al activarlo.
  useEffect(() => {
    if (!tvMode) return
    const timer = setInterval(() => {
      setActiveNav(i => (i + 1) % NAV.length)
      setViewKey(k => k + 1)
    }, TV_ROTATION_MS)
    return () => clearInterval(timer)
  }, [tvMode])

  const now   = new Date()
  const fecha = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  if (isWallboard) return <Wallboard />

  // Pantalla kiosco: se abre directamente en cada TV vía ?view=pantalla-*,
  // sin sidebar ni topbar, en modo fullscreen ("carrera de barras" grande).
  if (KioskComponent) {
    return (
      <div className="pantalla-kiosk">
        <KioskComponent tvMode />
      </div>
    )
  }

  const handleRefreshNow = async () => {
    if (isRefreshingNow) return
    setIsRefreshingNow(true)
    try {
      await refreshDatasetNow('mensual')
      await queryClient.invalidateQueries({ queryKey: ['hubspot-deals-dataset'] })
    } finally {
      setIsRefreshingNow(false)
    }
  }

  const isFetching = isRefreshingNow || isFetchingData

  return (
    <div className={`shell${tvMode ? ' tv-mode' : ''} view-pantalla`}>
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="logo">D</div>
        {NAV.map((item, i) => (
          <div
            key={i}
            className={`nav-btn${activeNav === i ? ' active' : ''}`}
            onClick={() => selectView(i)}
          >
            {item.icon}
            <span className="tip">{item.tip}</span>
          </div>
        ))}
        <div className="nav-spacer" />
        <div
          className={`nav-btn${showAjustes ? ' active' : ''}`}
          onClick={() => { setShowAjustes(s => !s); setActiveNav(0) }}
        >
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            <path d="M4.93 4.93a10 10 0 0 0 0 14.14"/>
          </svg>
          <span className="tip">Ajustes</span>
        </div>
      </aside>

      {/* MAIN */}
      <main className="main">
        {/* TOPBAR */}
        <div className="topbar">
          <div>
            <div className="page-title">{showAjustes ? 'Ranking de Asesores' : (VIEW_NAMES[activeNav] || 'Ranking de Asesores')}</div>
            <div className="page-sub">Díaz Lara &nbsp;·&nbsp; {fecha}</div>
          </div>
          <div className="topbar-right">
            <div
              className="live-chip"
              onClick={handleRefreshNow}
              style={{ cursor: isFetching ? 'default' : 'pointer' }}
              title="Actualizar ahora"
            >
              <div className="live-dot" />
              {isFetching ? 'Actualizando…' : ago ? `Actualizado ${ago}` : 'En vivo'}
            </div>
            <div className={`tv-btn${tvMode ? ' active' : ''}`} onClick={toggleTV} title={tvMode ? 'Salir de modo TV (Esc)' : 'Modo TV — pantalla completa'}>
              <svg viewBox="0 0 24 24">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <path d="M8 21h8M12 17v4"/>
              </svg>
              {tvMode ? 'TV on' : 'TV'}
            </div>
          </div>
        </div>

        {/* Vista Ajustes */}
        {showAjustes && (
          <VistaAjustes
            tvMode={tvMode}
            onToggleTV={toggleTV}
            refreshInterval={refreshInterval}
            onRefreshInterval={setRefreshInterval}
          />
        )}

        {/* Views — key fuerza re-mount y activa animación slideIn */}
        {!showAjustes && <div key={viewKey} className="view-enter">

          {activeNav === 0 && <PantallaDatosDelDia tvMode={tvMode} />}
          {activeNav === 1 && <PantallaDatosDelMes tvMode={tvMode} />}
          {activeNav === 2 && <PantallaVentasPorAno tvMode={tvMode} />}
          {activeNav === 3 && <PantallaPodioDelMes tvMode={tvMode} />}
          {activeNav === 4 && <PantallaParticipantesEventos tvMode={tvMode} />}

        </div>}

        {/* TV label bottom-right */}
        {tvMode && (
          <div className="tv-label">
            <div className="tv-label-dot" />
            {VIEW_NAMES[activeNav] || 'TV'} &nbsp;·&nbsp; en vivo
          </div>
        )}
      </main>
    </div>
  )
}
