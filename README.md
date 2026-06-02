# ranking-asesores

Dashboard de ranking en tiempo real para asesores de ventas. Consume datos de HubSpot a través de workflows de N8N expuestos como webhooks REST. Sin backend propio — el frontend consulta directamente los endpoints de N8N.

---

## Tecnologías

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | React | 18 |
| Bundler | Vite | 5 |
| Fetching / cache | @tanstack/react-query | 5 |
| Gráficas | Recharts | 2 |
| Utilidades de fecha | date-fns | 3 |
| Automatización / API | N8N | cloud o self-hosted |
| CRM | HubSpot | API v3 |

---

## Requisitos

- Node.js 18 o superior
- N8N con acceso a internet (cloud o self-hosted con URL pública)
- HubSpot con permisos de administrador para crear aplicaciones privadas

---

## Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-org/ranking-asesores.git
cd ranking-asesores
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Crear aplicación privada en HubSpot

1. Ir a **Configuración → Integraciones → Aplicaciones privadas**
2. Crear nueva aplicación, nombre sugerido: `N8N Ranking`
3. Activar los siguientes scopes:

```
crm.objects.deals.read
crm.objects.contacts.read
crm.objects.owners.read
crm.objects.engagements.read
crm.objects.line_items.read
crm.objects.products.read
```

4. Guardar el token generado

5. Ir a **Configuración → Propiedades → Negocios** y copiar el **API name** del campo de producto (ejemplo: `tipo_producto`)

### 4. Importar workflows en N8N

Importar los tres archivos de la carpeta `n8n/` desde **Workflows → Import from file**:

| Archivo | Endpoint generado |
|---------|------------------|
| `workflow-ranking-asesores.json` | `GET /webhook/ranking-asesores` |
| `workflow-leads-contactados.json` | `GET /webhook/leads-contactados` |
| `workflow-ranking-producto.json` | `GET /webhook/ranking-producto` |

Por cada workflow:

- Abrir el nodo de **HTTP Request** hacia HubSpot y asignar la credencial con el token del paso anterior
- En el nodo **Webhook**, activar **Header Auth** con `x-api-key` como nombre del header y una clave secreta como valor
- En `workflow-ranking-producto.json`, reemplazar `tipo_producto` por el API name real del campo de producto en HubSpot
- Activar el workflow y copiar la URL de producción del webhook

### 5. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env`:

```env
VITE_WEBHOOK_RANKING=https://tu-n8n.com/webhook/ranking-asesores
VITE_WEBHOOK_LEADS=https://tu-n8n.com/webhook/leads-contactados
VITE_WEBHOOK_PRODUCTO=https://tu-n8n.com/webhook/ranking-producto
VITE_API_KEY=clave_secreta_definida_en_n8n
VITE_REFRESH_INTERVAL=60000
```

> Si las variables no están definidas o apuntan a la URL de ejemplo, la aplicación arranca en **modo demo** con datos estáticos. Se indica con un badge visible en el header.

### 6. Correr en desarrollo

```bash
npm run dev
```

Disponible en `http://localhost:3000`.

### 7. Build de producción

```bash
npm run build
```

Genera la carpeta `/dist` con archivos estáticos. Se puede servir desde cualquier CDN o plataforma de hosting estático (Vercel, Netlify, S3, etc.).

---

## Deploy en Vercel

```bash
npm install -g vercel
vercel --prod
```

Agregar las variables de entorno desde **Settings → Environment Variables** en el dashboard de Vercel.

---

## Estructura

```
ranking-asesores/
├── src/
│   ├── components/
│   │   ├── Header.jsx              # Header con timestamp de última actualización
│   │   ├── KpiCards.jsx            # Tarjetas de resumen (leads, negocios, monto, asesor del día)
│   │   ├── RankingPodio.jsx        # Podio top 3 y tabla completa con tendencias
│   │   ├── RankingProducto.jsx     # Gráfica de barras horizontal y tabla por producto
│   │   └── TablaLeads.jsx          # Tabla de leads con filtro, búsqueda y paginación
│   ├── hooks/
│   │   └── useData.js              # Hooks de datos con polling automático y fallback a mock
│   ├── utils/
│   │   └── mockData.js             # Datos estáticos para modo demo
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── n8n/
│   ├── workflow-ranking-asesores.json
│   ├── workflow-leads-contactados.json
│   └── workflow-ranking-producto.json
├── .env.example
├── package.json
└── vite.config.js
```

---

## Contratos de API

Estructura JSON que deben devolver los webhooks de N8N.

### `GET /webhook/ranking-asesores`

```json
[
  {
    "rank": 1,
    "ownerId": "12345",
    "nombre": "Sofía Ramírez",
    "deals": 28,
    "monto": 485000,
    "leadsContactados": 64,
    "tendencia": "+3"
  }
]
```

### `GET /webhook/leads-contactados`

```json
[
  {
    "id": "L001",
    "nombre": "Grupo Alfa S.A.",
    "asesorId": "12345",
    "asesor": "Sofía Ramírez",
    "ultimaLlamada": "2026-05-24",
    "totalLlamadas": 4,
    "estadoNegocio": "Cerrado ganado"
  }
]
```

Valores válidos para `estadoNegocio`: `Cerrado ganado`, `Propuesta`, `Negociación`, `Contactado`, `Cerrado perdido`.

### `GET /webhook/ranking-producto`

```json
[
  {
    "producto": "Plan Empresarial",
    "ventas": 42,
    "monto": 840000,
    "pct": 38
  }
]
```

---

## Notas de configuración

**Paginación de HubSpot** — la API devuelve máximo 100 registros por llamada. Si el volumen de deals supera ese límite, implementar paginación en N8N usando el campo `paging.next.after` de la respuesta y un nodo de bucle (`Loop Over Items`).

**Intervalo de refresco** — controlado por `VITE_REFRESH_INTERVAL` en milisegundos. El valor mínimo recomendado es `30000` para no saturar los webhooks de N8N.

**Filtrado por período** — los webhooks aceptan query params opcionales `?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`. Implementar el filtro en el nodo `Code` de cada workflow comparando contra `closedate` del deal.

**Campo de producto** — el API name `tipo_producto` en los workflows es un placeholder. Debe reemplazarse por el nombre interno real del campo en HubSpot antes de activar el workflow de ranking por producto.
 
## Ajustes actuales de N8N

**Version de API** - los workflows usan la referencia actual de HubSpot `2026-03` para objetos CRM (`/crm/objects/2026-03/...`) y owners (`/crm/owners/2026-03`). La unica ruta legacy que queda es la lectura individual de asociaciones deal -> line_items con `/crm/v4/objects/.../associations/...`, que HubSpot sigue documentando para asociaciones por registro.

**Alineacion con las vistas de HubSpot** - los workflows actualizados aceptan `?periodo=diario|mensual|trimestral` y tambien rangos explicitos `?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`. Para negocios y productos el filtro por defecto usa `closedate`; para contactos usa `createdate`. Si una vista esta filtrada por otra fecha, agrega `fecha=createdate` o `fecha=closedate`.

**Negocios ganados** - asesores y producto filtran con `hs_is_closed_won=true` en vez de `dealstage=closedwon`, porque las etapas personalizadas de HubSpot no siempre usan `closedwon` como valor interno.

**Leads contactados** - leads consulta llamadas (`calls`) registradas en HubSpot, filtra por `hs_timestamp` y agrupa por asesor y contacto asociado. Si una llamada no tiene contacto asociado, aparece con el titulo de la llamada para que se pueda corregir la asociacion en HubSpot.

**Ranking por producto** - se calcula desde line items asociados a negocios ganados, no desde el catalogo de productos. La vista de productos sirve para validar nombres/catalogo; las ventas reales salen de los articulos de linea.
