import { useState } from 'react'
import { useRanking, useLeads, useProducto, useKpis } from './hooks/useData'
import Header      from './components/Header'
import KpiCards    from './components/KpiCards'
import RankingPodio from './components/RankingPodio'
import RankingProducto from './components/RankingProducto'
import TablaLeads  from './components/TablaLeads'

export default function App() {
  const [selectedAsesor, setSelectedAsesor] = useState(null)

  const ranking  = useRanking()
  const leads    = useLeads()
  const producto = useProducto()
  const kpis     = useKpis()

  const lastUpdate = kpis.data?.ultimaActualizacion || ranking.dataUpdatedAt

  return (
    <div className="app">
      <Header lastUpdate={lastUpdate} />

      <KpiCards
        data={kpis.data}
        isLoading={kpis.isLoading}
      />

      <div className="grid-main">
        {/* Columna izquierda: podio + tabla */}
        <RankingPodio
          data={ranking.data}
          isLoading={ranking.isLoading}
          selectedAsesor={selectedAsesor}
          onSelectAsesor={setSelectedAsesor}
        />

        {/* Columna derecha: ranking producto */}
        <RankingProducto
          data={producto.data}
          isLoading={producto.isLoading}
        />

        {/* Fila completa: leads */}
        <div className="grid-full">
          <TablaLeads
            data={leads.data}
            isLoading={leads.isLoading}
            selectedAsesor={selectedAsesor}
          />
        </div>
      </div>
    </div>
  )
}
