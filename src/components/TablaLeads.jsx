import { useState, useMemo } from 'react'
import styles from './TablaLeads.module.css'

const PAGE_SIZE = 10

const STATUS_COLORS = {
  'Cerrado ganado':  { bg: 'rgba(52,211,153,.1)',  color: '#34d399' },
  'Propuesta':       { bg: 'rgba(79,142,247,.1)',   color: '#4f8ef7' },
  'Negociación':     { bg: 'rgba(251,191,36,.1)',   color: '#fbbf24' },
  'Contactado':      { bg: 'rgba(138,143,168,.1)',  color: '#8a8fa8' },
  'Cerrado perdido': { bg: 'rgba(248,113,113,.1)',  color: '#f87171' },
}

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS['Contactado']
  return (
    <span className={styles.statusBadge} style={{ background: s.bg, color: s.color }}>
      {status}
    </span>
  )
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

export default function TablaLeads({ data, isLoading, selectedAsesor }) {
  const [search, setSearch] = useState('')
  const [page,   setPage]   = useState(1)

  const filtered = useMemo(() => {
    if (!data) return []
    let rows = data
    if (selectedAsesor) rows = rows.filter(r => r.asesorId === selectedAsesor)
    if (search.trim())  rows = rows.filter(r =>
      r.nombre.toLowerCase().includes(search.toLowerCase()) ||
      r.asesor.toLowerCase().includes(search.toLowerCase())
    )
    return rows
  }, [data, selectedAsesor, search])

  const pages     = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageData  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleSearch = v => { setSearch(v); setPage(1) }

  if (isLoading) return (
    <div className="card">
      <p className="card-title">Leads contactados</p>
      <div className={`skeleton`} style={{ height: 14, width: 200, marginBottom: 16, borderRadius: 4 }} />
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{ display:'flex', gap:12, marginBottom:12 }}>
          <div className={`skeleton`} style={{ flex:2, height:14, borderRadius:4 }} />
          <div className={`skeleton`} style={{ flex:1, height:14, borderRadius:4 }} />
          <div className={`skeleton`} style={{ flex:1, height:14, borderRadius:4 }} />
        </div>
      ))}
    </div>
  )

  return (
    <div className="card">
      <div className={styles.tableHeader}>
        <div>
          <p className="card-title" style={{ marginBottom: 2 }}>Leads contactados</p>
          <p className={styles.count}>
            {filtered.length} leads
            {selectedAsesor ? ' (filtrado por asesor)' : ''}
          </p>
        </div>
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            className={styles.search}
            type="text"
            placeholder="Buscar lead o asesor..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
          {search && (
            <button className={styles.clearSearch} onClick={() => handleSearch('')}>×</button>
          )}
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Lead / Empresa</th>
              <th>Asesor</th>
              <th>Última llamada</th>
              <th>Llamadas</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.empty}>
                  {search ? 'Sin resultados para esa búsqueda' : 'Sin leads registrados'}
                </td>
              </tr>
            ) : pageData.map(lead => (
              <tr key={lead.id} className={styles.row}>
                <td className={styles.leadNombre}>{lead.nombre}</td>
                <td className={styles.asesor}>{lead.asesor}</td>
                <td className={styles.fecha}>{formatDate(lead.ultimaLlamada)}</td>
                <td className={styles.calls}>
                  <span className={styles.callsBadge}>{lead.totalLlamadas}</span>
                </td>
                <td><StatusBadge status={lead.estadoNegocio} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pgBtn}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >← Ant.</button>
          <span className={styles.pgInfo}>
            Página {page} de {pages}
          </span>
          <button
            className={styles.pgBtn}
            onClick={() => setPage(p => Math.min(pages, p + 1))}
            disabled={page === pages}
          >Sig. →</button>
        </div>
      )}
    </div>
  )
}
