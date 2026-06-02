import { useState } from 'react'
import { useRankingProducto } from '../hooks/useData'

const PROD_COLORS = ['#c8a96e', '#b87333', '#8b7355', '#5c4a35', '#3a3530', '#272727']

const shortName = name => {
  const words = name.trim().split(/\s+/)
  const short  = words.slice(0, 2).join(' ')
  return short.length > 16 ? short.substring(0, 15) + '…' : short
}

const fmtMXN = n => new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
}).format(n)

export default function RankingProducto({ periodo }) {
  const { data, isLoading, isError, error } = useRankingProducto(periodo)
  const [open, setOpen] = useState(null)

  if (isLoading) {
    return (
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Top productos</span>
          <span className="panel-meta">por ingreso</span>
        </div>
        <div className="state-box">Cargando productos…</div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Top productos</span>
        </div>
        <div className="state-box" style={{ color: 'var(--red-w)' }}>Error: {error?.message}</div>
      </div>
    )
  }

  const { ranking = [] } = data || {}
  const top = ranking.slice(0, 6)
  const maxV = top[0]?.totalVentas || 1

  if (top.length === 0) {
    return (
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Top productos</span>
        </div>
        <div className="state-box">Sin datos de productos en este periodo.</div>
      </div>
    )
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">Top productos</span>
        <span className="panel-meta">por ingreso</span>
      </div>

      {/* MICRO CHART */}
      <div className="microchart">
        {top.map((p, i) => {
          const h = Math.max(2, Math.round(p.totalVentas / maxV * 44))
          return (
            <div key={p.producto} className="mbar" style={{ height: h, background: PROD_COLORS[i % PROD_COLORS.length] }}>
              <div className="mbar-tip">${(p.totalVentas / 1000).toFixed(0)}k</div>
            </div>
          )
        })}
      </div>
      <div className="mbar-lbls">
        {top.map(p => (
          <div key={p.producto} className="mbar-lbl">{shortName(p.producto)}</div>
        ))}
      </div>

      {/* PRODUCT LIST */}
      {top.map((p, i) => {
        const isOpen = open === p.producto
        return (
          <div key={p.producto} style={{ borderBottom: i < top.length - 1 ? '1px solid var(--b1)' : 'none' }}>
            <div
              className="prod-row"
              style={{ borderBottom: 'none' }}
              onClick={() => setOpen(isOpen ? null : p.producto)}
            >
              <div className="prod-n">{i + 1}</div>
              <div className="prod-line" style={{ background: PROD_COLORS[i % PROD_COLORS.length] }} />
              <div className="prod-info">
                <div className="prod-name" title={p.producto}>{shortName(p.producto)}</div>
                <div className="prod-units">{p.unidades} unidades</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="prod-amt">{fmtMXN(p.totalVentas)}</div>
                <svg
                  viewBox="0 0 24 24"
                  style={{
                    width: 10, height: 10,
                    stroke: 'var(--muted)', fill: 'none',
                    strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
                    transition: 'transform 0.22s ease',
                    transform: isOpen ? 'rotate(180deg)' : 'none',
                    flexShrink: 0,
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            {/* DETAIL */}
            <div
              className="prod-detail"
              style={{ maxHeight: isOpen ? 80 : 0, opacity: isOpen ? 1 : 0 }}
            >
              <div style={{ padding: '10px 16px 14px' }}>
                <div style={{
                  fontFamily: 'var(--sans)', fontSize: 9, color: 'var(--muted)',
                  letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8,
                }}>
                  Resumen
                </div>
                <div style={{ display: 'flex', gap: 24 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 18, color: 'var(--cream)' }}>
                      {fmtMXN(p.totalVentas)}
                    </div>
                    <div style={{ fontFamily: 'var(--sans)', fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>ingreso total</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 18, color: 'var(--gold)' }}>
                      {p.unidades}
                    </div>
                    <div style={{ fontFamily: 'var(--sans)', fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>unidades</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 18, color: 'var(--text)' }}>
                      {fmtMXN(Math.round(p.totalVentas / (p.unidades || 1)))}
                    </div>
                    <div style={{ fontFamily: 'var(--sans)', fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>precio promedio</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
