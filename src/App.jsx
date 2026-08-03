import { useMemo, useState, useEffect } from 'react'
import { useRankingAsesores, useLeadsContactados, refreshDatasetNow } from './hooks/useData'
import KpiCards from './components/KpiCards'
import RankingPodio from './components/RankingPodio'
import RankingProducto from './components/RankingProducto'
import TablaLeads from './components/TablaLeads'
import StarCard from './components/StarCard'
import Wallboard from './components/Wallboard'
import VistaEquipo from './components/VistaEquipo'
import VistaDeals from './components/VistaDeals'
import VistaReportes from './components/VistaReportes'
import VistaAjustes from './components/VistaAjustes'

const PERIODOS = [
  { value: 'diario',    label: 'Hoy' },
  { value: 'mensual',   label: 'Este mes' },
  { value: 'mes_pasado', label: 'Mes pasado' },
  { value: 'trimestral', label: 'Trimestre' },
]

function timeAgo(date) {
  if (!date) return null
  const diff = Math.floor((Date.now() - new Date(date)) / 1000)
  if (diff < 60) return `hace ${diff}s`
  return `hace ${Math.floor(diff / 60)}min`
}

const NAV = [
  {
    tip: 'Ranking',
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    tip: 'Equipo',
    icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="9" cy="7" r="4"/>
        <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        <path d="M21 21v-2a4 4 0 0 0-3-3.87"/>
      </svg>
    ),
  },
  {
    tip: 'Deals',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
    ),
  },
  {
    tip: 'Reportes',
    icon: (
      <svg viewBox="0 0 24 24">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
]

function PipelinePanel({ leads }) {
  const getStageType = status => {
    const stage = String(status || '').toLowerCase()
    if (
      stage === 'closedwon' ||
      stage === '1338692463' ||
      stage.includes('won') ||
      stage.includes('ganado') ||
      stage.includes('exitoso')
    ) return 'ganado'
    if (stage.includes('lost') || stage.includes('perdido')) return 'perdido'
    return 'proceso'
  }

  const stats = useMemo(() => {
    const ganados  = leads.filter(l => getStageType(l.estadoNegocio) === 'ganado').length
    const perdidos = leads.filter(l => getStageType(l.estadoNegocio) === 'perdido').length
    const proceso  = leads.length - ganados - perdidos
    const total    = leads.length || 1
    return { ganados, perdidos, proceso, total }
  }, [leads])

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">Pipeline</span>
        <span className="panel-meta">{stats.total} negocios</span>
      </div>
      <div className="pipe-section">
        <div className="plbl">Distribución del periodo</div>
        <div className="pbar-multi">
          <div className="ps" style={{ flex: stats.ganados  || 0.01, background: 'var(--gold)'  }} title={`Ganados: ${stats.ganados}`} />
          <div className="ps" style={{ flex: stats.proceso  || 0.01, background: 'var(--warm1)' }} title={`En proceso: ${stats.proceso}`} />
          <div className="ps" style={{ flex: stats.perdidos || 0.01, background: 'var(--red-w)' }} title={`Perdidos: ${stats.perdidos}`} />
        </div>
        <div className="pleg">
          <div className="pleg-item">
            <div className="pleg-line" style={{ background: 'var(--gold)' }} />
            Ganados {stats.ganados}
          </div>
          <div className="pleg-item">
            <div className="pleg-line" style={{ background: 'var(--warm1)' }} />
            En proceso {stats.proceso}
          </div>
          <div className="pleg-item">
            <div className="pleg-line" style={{ background: 'var(--red-w)' }} />
            Perdidos {stats.perdidos}
          </div>
        </div>
      </div>
    </div>
  )
}

const TV_VIEWS    = [0, 1, 3]              // Ranking → Equipo → Reportes
const TV_DURATION = 18_000                 // ms por vista
const VIEW_NAMES  = ['Ranking', 'Equipo', 'Deals', 'Reportes']

export default function App() {
  const [periodo, setPeriodo]           = useState('mensual')
  const [activeNav, setActiveNav]       = useState(0)
  const [isRefreshingNow, setIsRefreshingNow] = useState(false)
  const [ago, setAgo]                   = useState(null)
  const [tvMode, setTvMode]             = useState(false)
  const [tvProgress, setTvProgress]     = useState(0)
  const [viewKey, setViewKey]           = useState(0)
  const [tvDuration, setTvDuration]         = useState(TV_DURATION)
  const [showAjustes, setShowAjustes]       = useState(false)
  const [refreshInterval, setRefreshInterval] = useState(
    Number(import.meta.env.VITE_REFRESH_INTERVAL || 60_000)
  )

  const searchParams = new URLSearchParams(window.location.search)
  const isWallboard = window.location.pathname === '/pantalla' || searchParams.get('view') === 'pantalla'

  const ranking = useRankingAsesores(periodo, refreshInterval)
  const leads   = useLeadsContactados(periodo, refreshInterval)

  const rankingRows = ranking.data?.ranking || []
  const leadsRows   = leads.data?.leads    || []

  const kpisData = useMemo(() => {
    const cerrados = rankingRows.reduce((s, a) => s + (a.numeroDeals || 0), 0)
    return {
      totalLeadsHoy: leadsRows.length,
      negociosMes:   cerrados,
      montoMes:      rankingRows.reduce((s, a) => s + (a.totalVentas || 0), 0),
    }
  }, [rankingRows, leadsRows])

  const lastUpdate = ranking.dataUpdatedAt || leads.dataUpdatedAt

  useEffect(() => {
    setAgo(timeAgo(lastUpdate))
    const t = setInterval(() => setAgo(timeAgo(lastUpdate)), 10_000)
    return () => clearInterval(t)
  }, [lastUpdate])

  // TV mode: cycle views + progress bar
  useEffect(() => {
    if (!tvMode) { setTvProgress(0); return }

    let start = Date.now()

    const progressRaf = { id: null }
    const tick = () => {
      const elapsed = (Date.now() - start) % TV_DURATION
      setTvProgress((elapsed / TV_DURATION) * 100)
      progressRaf.id = requestAnimationFrame(tick)
    }
    progressRaf.id = requestAnimationFrame(tick)

    const viewTimer = setInterval(() => {
      start = Date.now()
      setActiveNav(prev => {
        const idx = TV_VIEWS.indexOf(prev)
        return TV_VIEWS[(idx + 1) % TV_VIEWS.length]
      })
    }, tvDuration)

    return () => {
      cancelAnimationFrame(progressRaf.id)
      clearInterval(viewTimer)
    }
  }, [tvMode, tvDuration])

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

  const now   = new Date()
  const fecha = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  if (isWallboard) return <Wallboard />

  const handleRefreshNow = async () => {
    if (isRefreshingNow) return
    setIsRefreshingNow(true)
    try {
      await refreshDatasetNow(periodo)
      await Promise.all([ranking.refetch(), leads.refetch()])
    } finally {
      setIsRefreshingNow(false)
    }
  }

  const isFetching = isRefreshingNow || ranking.isFetching || leads.isFetching

  return (
    <div className={`shell${tvMode ? ' tv-mode' : ''}${activeNav === 3 ? ' view-report' : ''}`}>
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
            <div className="page-title">Ranking de Asesores</div>
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
            <div className="tabs">
              {PERIODOS.map(p => (
                <div
                  key={p.value}
                  className={`tab${periodo === p.value ? ' active' : ''}`}
                  onClick={() => setPeriodo(p.value)}
                >
                  {p.label}
                </div>
              ))}
            </div>
            <div className={`tv-btn${tvMode ? ' active' : ''}`} onClick={toggleTV} title={tvMode ? 'Salir de modo TV (Esc)' : 'Modo TV — rotación automática'}>
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
            tvDuration={tvDuration}
            onTvDuration={setTvDuration}
            defaultPeriodo={periodo}
            onDefaultPeriodo={setPeriodo}
            tvMode={tvMode}
            onToggleTV={toggleTV}
            refreshInterval={refreshInterval}
            onRefreshInterval={setRefreshInterval}
          />
        )}

        {/* TV progress bar */}
        {tvMode && (
          <div className="tv-bar">
            <div className="tv-bar-fill" style={{ width: tvProgress + '%' }} />
          </div>
        )}

        {/* Views — key fuerza re-mount y activa animación slideIn */}
        {!showAjustes && <div key={viewKey} className="view-enter">

          {activeNav === 1 && <VistaEquipo periodo={periodo} tvMode={tvMode} />}
          {activeNav === 2 && <VistaDeals periodo={periodo} />}
          {activeNav === 3 && <VistaReportes periodo={periodo} tvMode={tvMode} />}

          {activeNav === 0 && (
            <>
              <KpiCards
                data={kpisData}
                isLoading={ranking.isLoading || leads.isLoading}
              />
              <div className="body-grid">
                <div className="left-col">
                  <RankingPodio periodo={periodo} />
                  <TablaLeads periodo={periodo} />
                </div>
                <div className="right-col">
                  <StarCard
                    asesor={rankingRows[0] || null}
                    isLoading={ranking.isLoading}
                    totalEquipo={kpisData.montoMes}
                  />
                  {!tvMode && <PipelinePanel leads={leadsRows} />}
                  <RankingProducto periodo={periodo} />
                </div>
              </div>
            </>
          )}

        </div>}

        {/* TV label bottom-right */}
        {tvMode && (
          <div className="tv-label">
            <div className="tv-label-dot" />
            {VIEW_NAMES[activeNav] || 'TV'} &nbsp;·&nbsp; rotando
          </div>
        )}
      </main>
    </div>
  )
}
