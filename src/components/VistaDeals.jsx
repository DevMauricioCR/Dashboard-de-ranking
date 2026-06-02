import { useState, useMemo } from 'react'
import { useLeadsContactados } from '../hooks/useData'

const PAGE_SIZE = 15

const fmtMXN = n => new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
}).format(n)

const fmtDate = iso => {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: '2-digit' })
}

function stageInfo(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'closedwon' || s === '1338692463' || s.includes('won') || s.includes('ganado') || s.includes('exitoso'))
    return { cls: 'badge-won', label: 'Ganado' }
  if (s.includes('lost') || s.includes('perdido'))
    return { cls: 'badge-lost', label: 'Perdido' }
  return { cls: 'badge-open', label: 'En proceso' }
}

const SORTS = {
  fecha_desc: (a, b) => new Date(b.ultimaLlamada || 0) - new Date(a.ultimaLlamada || 0),
  fecha_asc:  (a, b) => new Date(a.ultimaLlamada || 0) - new Date(b.ultimaLlamada || 0),
  monto_desc: (a, b) => (b.monto || 0) - (a.monto || 0),
  monto_asc:  (a, b) => (a.monto || 0) - (b.monto || 0),
}

function SortHeader({ label, field, sort, onSort, style }) {
  const isActive  = sort.startsWith(field)
  const isDesc    = sort === field + '_desc'
  return (
    <div
      className="col-hdr"
      onClick={() => onSort(isDesc ? field + '_asc' : field + '_desc')}
      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, userSelect: 'none', ...style }}
    >
      {label}
      <span style={{ color: isActive ? 'var(--gold)' : 'var(--b3)', fontSize: 8 }}>
        {isActive ? (isDesc ? '↓' : '↑') : '↕'}
      </span>
    </div>
  )
}

export default function VistaDeals({ periodo }) {
  const { data, isLoading, isError, error } = useLeadsContactados(periodo)
  const [search,  setSearch]  = useState('')
  const [filter,  setFilter]  = useState('todos')
  const [asesor,  setAsesor]  = useState('todos')
  const [sort,    setSort]    = useState('fecha_desc')
  const [page,    setPage]    = useState(1)

  const leads = data?.leads || []

  const asesores = useMemo(() => {
    const uniq = [...new Set(leads.map(l => l.asesor).filter(Boolean))]
    return uniq.sort()
  }, [leads])

  const totalMonto = useMemo(() =>
    leads.filter(l => stageInfo(l.estadoNegocio).cls === 'badge-won')
         .reduce((s, l) => s + (l.monto || 0), 0),
  [leads])

  const filtered = useMemo(() => {
    let rows = leads
    if (filter === 'ganados') rows = rows.filter(r => stageInfo(r.estadoNegocio).cls === 'badge-won')
    if (filter === 'proceso') rows = rows.filter(r => stageInfo(r.estadoNegocio).cls === 'badge-open')
    if (filter === 'perdidos') rows = rows.filter(r => stageInfo(r.estadoNegocio).cls === 'badge-lost')
    if (asesor !== 'todos')   rows = rows.filter(r => r.asesor === asesor)
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(r =>
        r.nombre?.toLowerCase().includes(q) ||
        r.asesor?.toLowerCase().includes(q) ||
        r.dealNombre?.toLowerCase().includes(q)
      )
    }
    return [...rows].sort(SORTS[sort] || SORTS.fecha_desc)
  }, [leads, filter, asesor, search, sort])

  const pages    = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const reset = (fn, val) => { fn(val); setPage(1) }

  const STATUS_CHIPS = [
    { value: 'todos',    label: 'Todos' },
    { value: 'ganados',  label: 'Ganados' },
    { value: 'proceso',  label: 'En proceso' },
    { value: 'perdidos', label: 'Perdidos' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'up 0.5s ease both' }}>
      {/* HEADER */}
      <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--b2)' }}>
        <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 4 }}>
          Deals
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 'bold', letterSpacing: '-0.03em', color: 'var(--text)' }}>
            {filtered.length} negocios
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 15, color: 'var(--gold)' }}>
            {fmtMXN(totalMonto)} ganados
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="panel" style={{ padding: 0 }}>
        <div className="clients-filter" style={{ flexWrap: 'wrap', gap: 10 }}>
          {/* search */}
          <div className="srch" style={{ minWidth: 220 }}>
            <svg style={{ width: 11, height: 11, stroke: 'var(--dim)', fill: 'none', strokeWidth: 1.5, strokeLinecap: 'round', flexShrink: 0 }} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="srch-input"
              placeholder="Buscar cliente, deal, asesor…"
              value={search}
              onChange={e => reset(setSearch, e.target.value)}
            />
          </div>

          {/* status chips */}
          <div className="chip-row">
            {STATUS_CHIPS.map(c => (
              <div
                key={c.value}
                className={`chip${filter === c.value ? ' active' : ''}`}
                onClick={() => reset(setFilter, c.value)}
              >
                {c.label}
              </div>
            ))}
          </div>

          {/* asesor selector */}
          <select
            value={asesor}
            onChange={e => reset(setAsesor, e.target.value)}
            style={{
              background: 'var(--s2)',
              border: '1px solid var(--b2)',
              color: asesor !== 'todos' ? 'var(--text)' : 'var(--muted)',
              fontFamily: 'var(--sans)',
              fontSize: 10,
              padding: '4px 10px',
              outline: 'none',
              cursor: 'pointer',
              letterSpacing: '0.04em',
            }}
          >
            <option value="todos">Todos los asesores</option>
            {asesores.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* TABLE */}
        {isLoading ? (
          <div className="state-box">Cargando deals…</div>
        ) : isError ? (
          <div className="state-box" style={{ color: 'var(--red-w)' }}>Error: {error?.message}</div>
        ) : (
          <>
            {/* header row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 140px 180px 110px 80px 110px',
              alignItems: 'center',
              padding: '7px 18px',
              borderBottom: '1px solid var(--b2)',
              gap: 8,
            }}>
              <div className="col-hdr">Cliente</div>
              <div className="col-hdr">Asesor</div>
              <div className="col-hdr">Deal</div>
              <SortHeader label="Monto"  field="monto" sort={sort} onSort={setSort} style={{ justifyContent: 'flex-end' }} />
              <SortHeader label="Fecha"  field="fecha" sort={sort} onSort={setSort} />
              <div className="col-hdr">Estado</div>
            </div>

            {pageData.length === 0 ? (
              <div className="state-box">Sin resultados para los filtros aplicados</div>
            ) : pageData.map((lead, i) => {
              const { cls, label } = stageInfo(lead.estadoNegocio)
              return (
                <div
                  key={`${lead.contactId || lead.dealId}-${i}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 140px 180px 110px 80px 110px',
                    alignItems: 'center',
                    padding: '10px 18px',
                    borderBottom: '1px solid var(--b1)',
                    gap: 8,
                    transition: 'background .12s',
                    cursor: 'default',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--b1)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <div style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {lead.nombre}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {lead.asesor}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {lead.dealNombre}
                  </div>
                  <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13, color: lead.monto > 0 ? 'var(--cream)' : 'var(--dim)', textAlign: 'right' }}>
                    {lead.monto > 0 ? fmtMXN(lead.monto) : '—'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--dim)' }}>
                    {fmtDate(lead.ultimaLlamada)}
                  </div>
                  <div><span className={`badge ${cls}`}>{label}</span></div>
                </div>
              )
            })}

            {/* PAGINATION */}
            <div className="pag">
              <div className="pag-info">
                Página {page} de {pages} &nbsp;·&nbsp; {filtered.length} registros
              </div>
              <div className="pag-btns">
                <div
                  className="pag-btn"
                  onClick={() => page > 1 && setPage(p => p - 1)}
                  style={page === 1 ? { opacity: 0.3, cursor: 'default' } : {}}
                >‹</div>
                {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
                  let p
                  if (pages <= 5)      p = i + 1
                  else if (page <= 3)  p = i + 1
                  else if (page >= pages - 2) p = pages - 4 + i
                  else p = page - 2 + i
                  return (
                    <div
                      key={p}
                      className={`pag-btn${page === p ? ' active' : ''}`}
                      onClick={() => setPage(p)}
                    >{p}</div>
                  )
                })}
                <div
                  className="pag-btn"
                  onClick={() => page < pages && setPage(p => p + 1)}
                  style={page === pages ? { opacity: 0.3, cursor: 'default' } : {}}
                >›</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
