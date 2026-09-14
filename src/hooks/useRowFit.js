import { useCallback, useEffect, useState } from 'react'

// Altura "de diseño" de una fila a escala 1 (la compacta que ya se usaba fija
// en TV) y el gap entre filas, usados como referencia para calcular cuánto
// hay que encoger o agrandar cada fila para que TODAS quepan en el alto
// disponible -- sin importar cuántas filas haya (7 asesores, 20, 3 eventos...)
// ni la resolución de la pantalla (celular, monitor, TV 4K).
const BASE_ROW_HEIGHT = 54
const BASE_GAP = 4
const MIN_SCALE = 0.42
const MAX_SCALE = 1.55

// containerRef es un "callback ref" (en vez de useRef) a propósito: estas
// pantallas primero muestran un estado de carga sin el contenedor real, así
// que el nodo aparece recién en un render posterior -- un useRef normal con
// useEffect no se vuelve a ejecutar solo porque el ref se llenó después.
export default function useRowFit(rowCount, active = true) {
  const [containerEl, setContainerEl] = useState(null)
  const containerRef = useCallback(node => setContainerEl(node), [])
  const [scale, setScale] = useState(1)

  useEffect(() => {
    if (!active || !rowCount) {
      setScale(1)
      return undefined
    }
    if (!containerEl) return undefined

    const measure = () => {
      const height = containerEl.clientHeight
      if (!height) return
      const idealTotal = rowCount * BASE_ROW_HEIGHT + Math.max(0, rowCount - 1) * BASE_GAP
      const next = height / idealTotal
      setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, next)))
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(containerEl)
    return () => ro.disconnect()
  }, [rowCount, active, containerEl])

  return { containerRef, scale }
}
