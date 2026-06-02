import { useState, useEffect, useRef } from 'react'
import { useRankingAsesores } from '../hooks/useData'

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

function ShareBar({ pct, color = 'var(--gold)' }) {
  const ref = useRef(null)
  useEffect(() => {
    const t = setTimeout(() => { if (ref.current) ref.current.style.width = pct + '%' }, 400)
    return () => clearTimeout(t)
  }, [pct])
  return (
    <div style={{ height: 2, background: 'var(--b2)', overflow: 'hidden', marginTop: 8 }}>
      <div ref={ref} style={{ height: '100%', width: 0, background: color, transition: 'width 1.1s cubic-bezier(0.16,1,0.3,1)' }} />
    </div>
  )
}

const SORT_OPTIONS = [
  { value: 'rank',   label: 'Posición' },
  { value: 'ventas', label: 'Ventas' },
  { value: 'deals',  label: 'Deals' },
]

export default function VistaEquipo({ periodo }) {
  const { data, isLoading, isError, error } = useRankingAsesores(periodo)
  const [sort, setSort]       = useState('rank')
  const [expanded, setExpanded] = useState(null)

  const { ranking = [], totalDeals } = data || {}
  const totalVentas = ranking.reduce((s, a) => s + a.totalVentas, 0) || 1

  const sorted = [...ranking].sort((a, b) => {
    if (sort === 'deals')  return b.numeroDeals - a.numeroDeals
    if (sort === 'ventas') return b.totalVentas - a.totalVentas
    return a.posicion - b.posicion
  })

  if (isLoading) return (
    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
      Cargando equipo…
    </div>
  )

  if (isError) return (
    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--red-w)', fontSize: 12 }}>
      Error: {error?.message}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'up 0.5s ease both' }}>
      {/* HEADER */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingBottom: 16, borderBottom: '1px solid var(--b2)',
      }}>
        <div>
          <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 4 }}>
            Equipo
          </div>
          <div style={{ fontSize: 20, fontWeight: 'bold', letterSpacing: '-0.03em', color: 'var(--text)' }}>
            {ranking.length} asesores &nbsp;·&nbsp; {totalDeals || 0} deals
          </div>
        </div>
        <div style={{ display: 'flex', gap: 1, border: '1px solid var(--b2)' }}>
          {SORT_OPTIONS.map(o => (
            <div
              key={o.value}
              onClick={() => setSort(o.value)}
              style={{
                padding: '5px 12px',
                fontFamily: 'var(--sans)',
                fontSize: 9,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                background: sort === o.value ? 'var(--gold)' : 'transparent',
                color: sort === o.value ? '#111' : 'var(--muted)',
                fontWeight: sort === o.value ? 'bold' : 'normal',
                borderRight: '1px solid var(--b2)',
                transition: 'all .15s',
              }}
            >
              {o.label}
            </div>
          ))}
        </div>
      </div>

      {/* GRID */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 1,
        background: 'var(--b2)',
        border: '1px solid var(--b2)',
      }}>
        {sorted.map((a, i) => {
          const isTop = a.posicion === 1
          const isWarn = a.nombre === 'Sin asesor asignado'
          const sharePct = (a.totalVentas / totalVentas) * 100
          const avg = Math.round(a.totalVentas / (a.numeroDeals || 1))
          const isOpen = expanded === a.ownerId

          return (
            <div
              key={a.ownerId}
              onClick={() => setExpanded(isOpen ? null : a.ownerId)}
              style={{
                background: isOpen ? 'var(--s3)' : isTop ? 'var(--s2)' : 'var(--s1)',
                padding: '20px 20px 16px',
                cursor: 'pointer',
                transition: 'background .15s',
                position: 'relative',
                animation: `up 0.4s ${0.05 * i}s ease both`,
              }}
            >
              {/* rank badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{
                  fontFamily: 'var(--serif)',
                  fontStyle: 'italic',
                  fontSize: 11,
                  color: isTop ? 'var(--gold)' : isWarn ? 'var(--red-w)' : 'var(--muted)',
                }}>
                  {isWarn ? 'Sin vincular' : `${a.posicion}° lugar`}
                </div>
                <div style={{
                  width: 36, height: 36,
                  border: `1px solid ${isTop ? 'var(--gold)' : isWarn ? 'var(--red-w)' : 'var(--b3)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--sans)',
                  fontSize: 11, fontWeight: 'bold',
                  color: isTop ? 'var(--gold)' : isWarn ? 'var(--red-w)' : 'var(--muted)',
                }}>
                  {initials(a.nombre)}
                </div>
              </div>

              {/* name */}
              <div style={{
                fontSize: 13,
                fontWeight: 'bold',
                color: isWarn ? 'var(--muted)' : 'var(--text)',
                marginBottom: 14,
                lineHeight: 1.3,
                fontStyle: isWarn ? 'italic' : 'normal',
              }}>
                {a.nombre}
              </div>

              {/* stats grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 1,
                background: 'var(--b2)',
                marginBottom: 0,
              }}>
                {[
                  { val: fmtCompact(a.totalVentas), lbl: 'Ventas' },
                  { val: a.numeroDeals,              lbl: 'Deals' },
                  { val: fmtMXN(avg),                lbl: 'Promedio' },
                  { val: `${sharePct.toFixed(1)}%`,  lbl: 'Share' },
                ].map(s => (
                  <div key={s.lbl} style={{
                    background: 'var(--s1)',
                    padding: '10px 12px',
                  }}>
                    <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 16, color: isTop ? 'var(--gold)' : 'var(--text)', lineHeight: 1, marginBottom: 3 }}>
                      {s.val}
                    </div>
                    <div style={{ fontFamily: 'var(--sans)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.08em' }}>
                      {s.lbl}
                    </div>
                  </div>
                ))}
              </div>

              <ShareBar pct={sharePct} color={isTop ? 'var(--gold)' : isWarn ? 'var(--red-w)' : 'var(--warm1)'} />

              {/* expanded deals */}
              {isOpen && a.deals?.length > 0 && (
                <div style={{
                  marginTop: 12,
                  borderTop: '1px solid var(--b2)',
                  paddingTop: 10,
                  maxHeight: 200,
                  overflowY: 'auto',
                }}>
                  <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Deals cerrados
                  </div>
                  {a.deals.slice(0, 10).map((d, di) => (
                    <div key={d.id || di} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '5px 0',
                      borderBottom: '1px solid var(--b1)',
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                        {d.nombre}
                      </div>
                      <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 12, color: 'var(--cream)', flexShrink: 0 }}>
                        {fmtMXN(d.monto)}
                      </div>
                    </div>
                  ))}
                  {a.deals.length > 10 && (
                    <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 6, textAlign: 'center' }}>
                      +{a.deals.length - 10} más
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
