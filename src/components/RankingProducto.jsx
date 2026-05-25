import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import styles from './RankingProducto.module.css'

const fmtM = n => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`
  return `$${n}`
}

const COLORS = ['#4f8ef7', '#7c5ce8', '#34d399', '#fbbf24', '#f87171', '#60a5fa']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.tooltip}>
      <p className={styles.ttLabel}>{label}</p>
      <p className={styles.ttVal}>{payload[0].name === 'ventas'
        ? `${payload[0].value} ventas`
        : fmtM(payload[0].value)
      }</p>
    </div>
  )
}

export default function RankingProducto({ data, isLoading }) {
  const [mode, setMode] = useState('ventas')

  if (isLoading) return (
    <div className="card">
      <p className="card-title">Ranking por producto</p>
      <div className={`skeleton`} style={{ height: 200, borderRadius: 'var(--r-md)' }} />
    </div>
  )

  if (!data?.length) return null

  const total = data.reduce((s, p) => s + p[mode], 0)
  const max   = Math.max(...data.map(p => p[mode]))

  return (
    <div className="card">
      <div className={styles.header}>
        <p className="card-title" style={{ marginBottom: 0 }}>Por producto</p>
        <div className={styles.toggle}>
          <button
            className={`${styles.btn} ${mode === 'ventas' ? styles.active : ''}`}
            onClick={() => setMode('ventas')}
          >Unidades</button>
          <button
            className={`${styles.btn} ${mode === 'monto' ? styles.active : ''}`}
            onClick={() => setMode('monto')}
          >Monto</button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
          <XAxis
            type="number"
            tick={{ fill: 'var(--text-3)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={mode === 'monto' ? fmtM : undefined}
          />
          <YAxis
            type="category"
            dataKey="producto"
            tick={{ fill: 'var(--text-2)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={110}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey={mode} radius={[0, 4, 4, 0]} maxBarSize={22}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className={styles.list}>
        {data.map((p, i) => {
          const pct = total ? Math.round((p[mode] / total) * 100) : 0
          return (
            <div key={p.producto} className={styles.item}>
              <span className={styles.dot} style={{ background: COLORS[i % COLORS.length] }} />
              <span className={styles.prod}>{p.producto}</span>
              <span className={styles.pct}>{pct}%</span>
              <span className={styles.val}>
                {mode === 'ventas' ? `${p.ventas} vtas` : fmtM(p.monto)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
