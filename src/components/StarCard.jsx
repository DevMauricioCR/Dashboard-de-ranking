import { useEffect, useRef } from 'react'

const fmtMXN = n => new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
}).format(n)

const fmtCompact = n => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`
  return `$${Math.round(n)}`
}

function initials(name = '') {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return name.substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function ShareBar({ pct }) {
  const ref = useRef(null)
  useEffect(() => {
    const t = setTimeout(() => {
      if (ref.current) ref.current.style.width = pct + '%'
    }, 500)
    return () => clearTimeout(t)
  }, [pct])

  return (
    <div style={{ padding: '12px 16px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 9, color: 'rgba(0,0,0,0.55)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Participación del periodo
        </span>
        <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 12, color: 'rgba(0,0,0,0.7)' }}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div style={{ height: 3, background: 'rgba(0,0,0,0.15)', overflow: 'hidden' }}>
        <div
          ref={ref}
          style={{ height: '100%', width: 0, background: '#0a0a0a', transition: 'width 1.2s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </div>
    </div>
  )
}

export default function StarCard({ asesor, isLoading, totalEquipo }) {
  if (isLoading) {
    return <div className="star-skeleton" />
  }

  if (!asesor) {
    return (
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Asesor destacado</span>
        </div>
        <div className="state-box">Sin datos del periodo.</div>
      </div>
    )
  }

  const ini     = initials(asesor.nombre)
  const avg     = fmtMXN(Math.round(asesor.totalVentas / (asesor.numeroDeals || 1)))
  const sharePct = totalEquipo > 0 ? (asesor.totalVentas / totalEquipo) * 100 : 0

  return (
    <div className="star-card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* PHOTO AREA */}
      <div style={{ position: 'relative', width: '100%', height: 180, overflow: 'hidden', background: 'rgba(0,0,0,0.18)' }}>
        <svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%', display: 'block' }}>
          <rect width="320" height="180" fill="rgba(0,0,0,0.10)" />
          <defs>
            <pattern id="hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(0,0,0,0.8)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect x="0" y="0" width="320" height="180" fill="url(#hatch)" opacity="0.08" />
          <ellipse cx="160" cy="230" rx="80" ry="60" fill="rgba(0,0,0,0.28)" />
          <circle cx="160" cy="100" r="52" fill="rgba(0,0,0,0.22)" />
          <text
            x="160" y="112"
            textAnchor="middle"
            fontFamily="Georgia,serif"
            fontStyle="italic"
            fontSize="40"
            fill="rgba(0,0,0,0.40)"
          >
            {ini}
          </text>
        </svg>

        {/* gradient bottom */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 70,
          background: 'linear-gradient(to bottom, transparent, var(--gold))',
        }} />

        {/* label top-left */}
        <div style={{
          position: 'absolute', top: 14, left: 16,
          fontFamily: 'var(--sans)', fontSize: 9, color: 'rgba(0,0,0,0.55)',
          letterSpacing: '0.16em', textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ width: 10, height: 1, background: 'rgba(0,0,0,0.4)', display: 'inline-block' }} />
          Asesor #1
        </div>

        {/* name overlay */}
        <div style={{ position: 'absolute', bottom: 14, left: 16, right: 16 }}>
          <div style={{
            fontFamily: 'var(--sans)', fontSize: 20, fontWeight: 'bold',
            color: '#0a0a0a', lineHeight: 1.1, letterSpacing: '-0.03em',
          }}>
            {asesor.nombre}
          </div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 10, color: 'rgba(0,0,0,0.55)', marginTop: 3, letterSpacing: '0.04em' }}>
            Más ventas del periodo
          </div>
        </div>
      </div>

      {/* STATS GRID */}
      <div className="star-grid">
        <div className="star-stat">
          <div className="sval">{fmtCompact(asesor.totalVentas)}</div>
          <div className="slbl">Ventas totales</div>
        </div>
        <div className="star-stat">
          <div className="sval">{asesor.numeroDeals}</div>
          <div className="slbl">Deals cerrados</div>
        </div>
        <div className="star-stat">
          <div className="sval">{avg}</div>
          <div className="slbl">Ticket promedio</div>
        </div>
        <div className="star-stat">
          <div className="sval">{sharePct.toFixed(1)}%</div>
          <div className="slbl">Share del total</div>
        </div>
      </div>

      <ShareBar pct={sharePct} />
    </div>
  )
}
