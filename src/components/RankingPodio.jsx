import { useState, useEffect, useRef } from 'react'
import { useRankingAsesores } from '../hooks/useData'

const fmtMXN = n => new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
}).format(n)

const fmtDate = iso => {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

const fmtPct = n => `${Math.max(0, Math.round(Number(n) || 0))}%`

function initials(name = '') {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return name.substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function AnimBar({ target, delay = 0, className, style }) {
  const ref = useRef(null)
  useEffect(() => {
    const t = setTimeout(() => {
      if (ref.current) ref.current.style.width = target + '%'
    }, 300 + delay)
    return () => clearTimeout(t)
  }, [target, delay])
  return <div ref={ref} className={className} style={{ ...style, width: '0%' }} />
}

function RowDetail({ asesor }) {
  const metaPeriodo = asesor.metaPeriodo || asesor.metaMensual

  return (
    <div className="rrow-detail" style={{ maxHeight: 80, opacity: 1 }}>
      <div style={{ padding: '14px 18px' }}>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Asesor</div>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 14, color: 'var(--text)' }}>{asesor.nombre}</div>
      </div>
      <div style={{ padding: '14px 16px', borderLeft: '1px solid var(--b2)' }}>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Deals cerrados</div>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 22, color: 'var(--gold)' }}>{asesor.numeroDeals}</div>
      </div>
      <div style={{ padding: '14px 16px', borderLeft: '1px solid var(--b2)' }}>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Ticket promedio</div>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 22, color: 'var(--text)' }}>
          {fmtMXN(asesor.totalVentas / (asesor.numeroDeals || 1))}
        </div>
      </div>
      <div style={{ padding: '14px 16px', borderLeft: '1px solid var(--b2)' }}>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Total generado</div>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 22, color: 'var(--cream)' }}>{fmtMXN(asesor.totalVentas)}</div>
      </div>
      <div style={{ padding: '14px 16px', borderLeft: '1px solid var(--b2)' }}>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Meta del periodo</div>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 22, color: 'var(--text)' }}>
          {metaPeriodo ? `${fmtMXN(metaPeriodo)} Â· ${fmtPct(asesor.avanceMetaPct)}` : 'Sin meta'}
        </div>
      </div>
    </div>
  )
}

export default function RankingPodio({ periodo }) {
  const { data, isLoading, isError, error } = useRankingAsesores(periodo)
  const [expanded, setExpanded] = useState(null)

  const { ranking = [], desdeISO, hastaISO, totalDeals } = data || {}
  const top3  = ranking.slice(0, 3)
  const resto = ranking.slice(3)
  const max   = top3[0]?.totalVentas || 1

  const periodLabel = desdeISO && hastaISO
    ? `${fmtDate(desdeISO)} â€” ${fmtDate(hastaISO)}`
    : ''

  if (isLoading) {
    return (
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Ranking del periodo</span>
        </div>
        <div className="state-box">Cargando rankingâ€¦</div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Ranking del periodo</span>
        </div>
        <div className="state-box" style={{ color: 'var(--red-w)' }}>
          Error: {error?.message}
        </div>
      </div>
    )
  }

  if (ranking.length === 0) {
    return (
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Ranking del periodo</span>
        </div>
        <div className="state-box">Sin ventas registradas en este periodo.</div>
      </div>
    )
  }

  const podOrder = top3.length >= 3
    ? [top3[1], top3[0], top3[2]]
    : top3

  const podClass = top3.length >= 3
    ? ['p2', 'p1', 'p3']
    : ['p1', 'p2', 'p3']

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">Ranking del periodo</span>
        <span className="panel-meta">
          {periodLabel}{totalDeals ? ` Â· ${totalDeals} deals cerrados` : ''}
        </span>
      </div>

      {/* PODIO */}
      {top3.length > 0 && (
        <div className="podium">
          {podOrder.map((a, i) => a && (
            <div key={a.ownerId} className={`pod ${podClass[i]}`}>
              <div className="pod-rank">{a.posicion}Â° lugar</div>
              <div className="pod-av">{initials(a.nombre)}</div>
              <div className="pod-name">{a.nombre}</div>
              {a.cargo && <div className="pod-deals">{a.cargo}</div>}
              <div className="pod-amount">{fmtMXN(a.totalVentas)}</div>
              <div className="pod-deals">
                {a.numeroDeals} deals &nbsp;Â·&nbsp; {fmtMXN(Math.round(a.totalVentas / (a.numeroDeals || 1)))} promedio
              </div>
              <div className="pod-deals">
                {(a.metaPeriodo || a.metaMensual) ? `Meta ${fmtMXN(a.metaPeriodo || a.metaMensual)} · ${fmtPct(a.avanceMetaPct)}` : 'Sin meta asignada'}
              </div>
              <div className="pod-bar">
                <AnimBar
                  target={(a.metaPeriodo || a.metaMensual) ? Math.min(100, a.avanceMetaPct) : Math.round(a.totalVentas / max * 100)}
                  delay={i * 80}
                  className="pod-bar-fill"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TABLA */}
      <div className="rrow hdr">
        <div className="col-hdr">#</div>
        <div className="col-hdr">Asesor</div>
        <div className="col-hdr" style={{ textAlign: 'center' }}>Deals</div>
        <div className="col-hdr" style={{ textAlign: 'right' }}>Promedio</div>
        <div className="col-hdr" style={{ textAlign: 'right' }}>Total</div>
        <div className="col-hdr">Meta del periodo</div>
      </div>

      {resto.map((a, i) => {
        const metaPeriodo = a.metaPeriodo || a.metaMensual
        const pct = metaPeriodo ? Math.min(100, a.avanceMetaPct) : Math.round(a.totalVentas / max * 100)
        const isOpen = expanded === a.ownerId
        const isWarn = a.nombre === 'Sin asesor asignado'
        return (
          <div key={a.ownerId}>
            <div
              className={`rrow${isWarn ? ' warn-row' : ''}`}
              style={isOpen ? { background: 'rgba(200,169,110,0.04)' } : {}}
              onClick={() => setExpanded(isOpen ? null : a.ownerId)}
            >
              <div className="rpos">{a.posicion}</div>
              <div className="rav">
                <div className="av-sm">{initials(a.nombre)}</div>
                <span className="rname">
                  {a.nombre}
                  {a.cargo && <small style={{ display: 'block', color: 'var(--muted)', fontSize: 10, marginTop: 2 }}>{a.cargo}</small>}
                </span>
              </div>
              <div className="rdeals">{a.numeroDeals}</div>
              <div className="ravg">{fmtMXN(Math.round(a.totalVentas / (a.numeroDeals || 1)))}</div>
              <div className="ramt">{fmtMXN(a.totalVentas)}</div>
              <div className="rprog">
                <div className="pbar">
                  <AnimBar target={pct} delay={300 + i * 55} className="pfill" />
                </div>
                <span className="ppct">
                  {metaPeriodo ? `${fmtPct(a.avanceMetaPct)} · ${fmtMXN(metaPeriodo)}` : `${pct}%`}
                </span>
              </div>
            </div>
            {isOpen && <RowDetail asesor={a} />}
          </div>
        )
      })}
    </div>
  )
}


