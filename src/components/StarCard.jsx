import { useEffect, useRef } from 'react'
import { getAdvisorPhoto } from './AdvisorAvatar'

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
        <span style={{ fontFamily: 'var(--sans)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Participación del periodo
        </span>
        <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 12, color: 'var(--cyan)' }}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <div
          ref={ref}
          style={{ height: '100%', width: 0, background: 'var(--cyan)', boxShadow: '0 0 8px var(--cyan)', transition: 'width 1.2s cubic-bezier(0.16,1,0.3,1)' }}
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
  const photo   = getAdvisorPhoto(asesor.nombre)
  const avg     = fmtMXN(Math.round(asesor.totalVentas / (asesor.numeroDeals || 1)))
  const sharePct = totalEquipo > 0 ? (asesor.totalVentas / totalEquipo) * 100 : 0

  return (
    <div className="star-card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* PHOTO AREA */}
      <div style={{ position: 'relative', width: '100%', height: 190, overflow: 'hidden', background: 'rgba(0,255,214,0.035)' }}>
        <svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%', display: 'block' }}>
          <rect width="320" height="180" fill="rgba(0,255,214,0.025)" />
          <defs>
            <pattern id="hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(0,255,214,0.28)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect x="0" y="0" width="320" height="180" fill="url(#hatch)" opacity="0.08" />
          {!photo && (
            <>
              <ellipse cx="160" cy="230" rx="76" ry="54" fill="rgba(0,255,214,0.06)" />
              <circle cx="160" cy="78" r="42" fill="rgba(0,255,214,0.06)" />
              <circle cx="160" cy="78" r="42" fill="none" stroke="rgba(0,255,214,0.30)" strokeWidth="1" />
              <text
                x="160" y="91"
                textAnchor="middle"
                fontFamily="var(--sans)"
                fontWeight="700"
                fontSize="34"
                fill="#00ffd6"
              >
                {ini}
              </text>
            </>
          )}
        </svg>
        {photo && (
          <div
            style={{
              position: 'absolute',
              top: 16,
              left: '50%',
              width: 120,
              height: 120,
              overflow: 'hidden',
              border: '1px solid rgba(0,255,214,0.30)',
              borderRadius: '50%',
              boxShadow: '0 0 16px rgba(0,255,214,0.16)',
              transform: 'translateX(-50%)',
            }}
          >
            <img
              src={photo}
              alt={asesor.nombre}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                display: 'block',
                objectFit: 'cover',
                objectPosition: asesor.nombre === 'Yuliana Rivera Fararoni' ? '60% 15%' : '50% 18%',
                transform: asesor.nombre === 'Yuliana Rivera Fararoni' ? 'scale(2.15)' : 'none',
                transformOrigin: asesor.nombre === 'Yuliana Rivera Fararoni' ? '60% 15%' : '50% 50%',
              }}
            />
          </div>
        )}

        {/* gradient bottom */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 70,
          background: 'linear-gradient(to bottom, transparent, rgba(5,7,8,.94))',
        }} />

        {/* label top-left */}
        <div style={{
          position: 'absolute', top: 14, left: 16,
          fontFamily: 'var(--sans)', fontSize: 9, color: 'var(--cyan)',
          letterSpacing: '0.16em', textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ width: 10, height: 1, background: 'var(--cyan)', display: 'inline-block', boxShadow: '0 0 6px var(--cyan)' }} />
          Asesor #1
        </div>

        {/* name overlay */}
        <div style={{ position: 'absolute', bottom: 18, left: 20, right: 20 }}>
          <div style={{
            fontFamily: 'var(--sans)', fontSize: 20, fontWeight: 'bold',
            color: 'var(--text)', lineHeight: 1.15, letterSpacing: 0,
          }}>
            {asesor.nombre}
          </div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 10, color: 'var(--muted)', marginTop: 3, letterSpacing: '0.04em' }}>
            Más ventas del periodo
          </div>
        </div>
      </div>

        {/* STATS GRID */}
      <div className="star-grid">
        <div className="star-stat">
          <div className="sval sval-total">{fmtCompact(asesor.totalVentas)}</div>
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
