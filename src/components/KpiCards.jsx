import { useState, useEffect } from 'react'

function useCountUp(target, duration = 1100) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!target) { setValue(0); return }
    const start = Date.now()
    let raf
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(ease * target))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

const fmtNum   = n => new Intl.NumberFormat('es-MX').format(n)
const fmtMoney = n => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`
  return `$${n}`
}

function KpiCreados({ total }) {
  const v = useCountUp(total)
  return (
    <div className="kpi">
      <div className="kpi-lbl">Negocios creados</div>
      <div className="kpi-val">{fmtNum(v)}</div>
      <div className="kpi-sub">en el periodo</div>
    </div>
  )
}

function KpiCerrados({ total }) {
  const v = useCountUp(total)
  return (
    <div className="kpi">
      <div className="kpi-lbl">Negocios cerrados</div>
      <div className="kpi-val">{fmtNum(v)}</div>
      <div className="kpi-sub">acumulado del periodo</div>
    </div>
  )
}

function KpiMonto({ total }) {
  const v = useCountUp(total)
  return (
    <div className="kpi accent">
      <div className="kpi-lbl">Monto total</div>
      <div className="kpi-val">{fmtMoney(v)}</div>
      <div className="kpi-sub">acumulado del periodo</div>
    </div>
  )
}

function SkeletonKpi() {
  return (
    <div className="kpi">
      <div className="skeleton" style={{ height: 9, width: 100, marginBottom: 12, borderRadius: 2 }} />
      <div className="skeleton" style={{ height: 34, width: 120, marginBottom: 8, borderRadius: 2 }} />
      <div className="skeleton" style={{ height: 9, width: 80,  borderRadius: 2 }} />
    </div>
  )
}

export default function KpiCards({ data, isLoading }) {
  if (isLoading) {
    return (
      <div className="kpi-row">
        <SkeletonKpi />
        <SkeletonKpi />
        <SkeletonKpi />
      </div>
    )
  }
  if (!data) return null

  return (
    <div className="kpi-row">
      <KpiCreados  total={data.totalLeadsHoy} />
      <KpiCerrados total={data.negociosMes} />
      <KpiMonto    total={data.montoMes} />
    </div>
  )
}
