import { useState, useMemo } from 'react'
import { useLeadsContactados } from '../hooks/useData'

const PAGE_SIZE = 10

const fmtDate = iso => {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

function stageInfo(status) {
  const s = String(status || '').toLowerCase()
  if (
    s === 'closedwon' ||
    s === '1338692463' ||
    s.includes('won') ||
    s.includes('ganado') ||
    s.includes('exitoso')
  ) return { cls: 'badge-won',  label: 'Cerrado ganado' }
  if (s.includes('lost') || s.includes('perdido')) return { cls: 'badge-lost', label: 'Perdido' }
  return { cls: 'badge-open', label: 'En proceso' }
}

export default function TablaLeads({ periodo }) {
  const { data, isLoading, isError, error } = useLeadsContactados(periodo)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('todos')
  const [page,   setPage]   = useState(1)

  const leads = data?.leads || []

  const filtered = useMemo(() => {
    let rows = leads
    if (filter === 'ganados')  rows = rows.filter(r => stageInfo(r.estadoNegocio).cls === 'badge-won')
    if (filter === 'proceso')  rows = rows.filter(r => stageInfo(r.estadoNegocio).cls === 'badge-open')
    if (filter === 'perdidos') rows = rows.filter(r => stageInfo(r.estadoNegocio).cls === 'badge-lost')
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(r =>
        r.nombre?.toLowerCase().includes(q) ||
        r.asesor?.toLowerCase().includes(q) ||
        r.dealNombre?.toLowerCase().includes(q)
      )
    }
    return rows
  }, [leads, filter, search])

  const pages    = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const setFilterReset = v => { setFilter(v); setPage(1) }
  const setSearchReset = v => { setSearch(v); setPage(1) }

  const CHIPS = [
    { value: 'todos',   label: 'Todos' },
    { value: 'ganados', label: 'Ganados' },
    { value: 'proceso', label: 'En proceso' },
    { value: 'perdidos',label: 'Perdidos' },
  ]

  return (
    <div className="panel clients-wrap">
      <div className="panel-head">
        <span className="panel-title">Clientes</span>
        <span className="panel-meta">{filtered.length} registros</span>
      </div>

      {/* FILTER BAR */}
      <div className="clients-filter">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
          <div className="srch">
            <svg style={{ width: 11, height: 11, stroke: 'var(--dim)', fill: 'none', strokeWidth: 1.5, strokeLinecap: 'round', flexShrink: 0 }} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="srch-input"
              placeholder="Buscar cliente, deal, asesor…"
              value={search}
              onChange={e => setSearchReset(e.target.value)}
            />
          </div>
          <div className="chip-row">
            {CHIPS.map(c => (
              <div
                key={c.value}
                className={`chip${filter === c.value ? ' active' : ''}`}
                onClick={() => setFilterReset(c.value)}
              >
                {c.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TABLE */}
      {isLoading ? (
        <div className="state-box">Cargando clientes…</div>
      ) : isError ? (
        <div className="state-box" style={{ color: 'var(--red-w)' }}>
          Error: {error?.message}
        </div>
      ) : (
        <>
          <div className="crow hdr">
            <div className="col-hdr">Cliente</div>
            <div className="col-hdr">Asesor</div>
            <div className="col-hdr">Deal</div>
            <div className="col-hdr">Fecha</div>
            <div className="col-hdr">Estado</div>
          </div>

          {pageData.length === 0 ? (
            <div className="state-box">
              {search || filter !== 'todos' ? 'Sin resultados para esa búsqueda' : 'Sin clientes registrados'}
            </div>
          ) : pageData.map((lead, i) => {
            const { cls, label } = stageInfo(lead.estadoNegocio)
            return (
              <div key={`${lead.contactId || lead.dealId}-${i}`} className="crow">
                <div className="cname">{lead.nombre}</div>
                <div className="casesor">{lead.asesor}</div>
                <div className="cdeal">{lead.dealNombre}</div>
                <div className="cdate">{fmtDate(lead.ultimaLlamada)}</div>
                <div><span className={`badge ${cls}`}>{label}</span></div>
              </div>
            )
          })}

          {/* PAGINATION */}
          <div className="pag">
            <div className="pag-info">
              Página {page} de {pages} &nbsp;·&nbsp; {filtered.length} clientes
            </div>
            <div className="pag-btns">
              <div
                className={`pag-btn${page === 1 ? ' pag-btn--disabled' : ''}`}
                onClick={() => page > 1 && setPage(p => p - 1)}
                style={page === 1 ? { opacity: 0.3, cursor: 'default' } : {}}
              >
                ‹
              </div>
              {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
                let p
                if (pages <= 5) {
                  p = i + 1
                } else if (page <= 3) {
                  p = i + 1
                } else if (page >= pages - 2) {
                  p = pages - 4 + i
                } else {
                  p = page - 2 + i
                }
                return (
                  <div
                    key={p}
                    className={`pag-btn${page === p ? ' active' : ''}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </div>
                )
              })}
              <div
                className="pag-btn"
                onClick={() => page < pages && setPage(p => p + 1)}
                style={page === pages ? { opacity: 0.3, cursor: 'default' } : {}}
              >
                ›
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
