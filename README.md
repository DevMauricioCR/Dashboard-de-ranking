# Ranking de Asesores de Ventas

Dashboard en tiempo real que muestra el ranking de asesores, leads contactados y ventas por producto, conectado a HubSpot vía N8N.

## Stack

- **Frontend**: React + Vite (sin backend)
- **Automatización**: N8N (actúa como backend/API)
- **CRM**: HubSpot
- **Datos**: Polling cada 60 segundos a webhooks de N8N

---

## 1. Configurar HubSpot

### Crear aplicación privada
1. Ve a **HubSpot → Configuración → Integraciones → Aplicaciones privadas**
2. Crea una nueva → nombre: "N8N Ranking"
3. Activa estos scopes:
   - `crm.objects.deals.read`
   - `crm.objects.contacts.read`
   - `crm.objects.owners.read`
   - `crm.objects.engagements.read`
4. Copia el **token** generado

### Verificar campo de producto
- Ve a **Configuración → Propiedades → Negocios**
- Busca tu campo de producto (ej. "Tipo de producto")
- Copia el **API name** interno (ej. `tipo_producto`)
- Actualiza ese nombre en el workflow `workflow-ranking-producto.json`

---

## 2. Importar workflows en N8N

1. En N8N, ve a **Workflows → Import from file**
2. Importa los 3 archivos de la carpeta `/n8n/`:
   - `workflow-ranking-asesores.json`
   - `workflow-leads-contactados.json`
   - `workflow-ranking-producto.json`
3. En cada workflow, configura la credencial de HubSpot:
   - Abre el nodo **HubSpot - Traer deals**
   - Selecciona o crea una credencial de tipo **HubSpot API**
   - Pega el token de tu aplicación privada
4. En el nodo **Webhook**, configura Header Auth:
   - Header name: `x-api-key`
   - Header value: una clave secreta que tú definas
5. **Activa** cada workflow (toggle en la esquina superior derecha)
6. Copia las 3 URLs de producción que genera cada webhook

---

## 3. Configurar y correr React

```bash
# 1. Instalar dependencias
npm install

# 2. Crear archivo de entorno
cp .env.example .env

# 3. Editar .env con tus URLs reales de N8N
# VITE_WEBHOOK_RANKING=https://tu-n8n.com/webhook/ranking-asesores
# VITE_WEBHOOK_LEADS=https://tu-n8n.com/webhook/leads-contactados
# VITE_WEBHOOK_PRODUCTO=https://tu-n8n.com/webhook/ranking-producto
# VITE_API_KEY=tu_clave_secreta

# 4. Correr en desarrollo (con datos de demo hasta que conectes N8N)
npm run dev

# 5. Build para producción
npm run build
```

> **Modo demo**: Si no tienes el `.env` configurado, la app corre con datos de ejemplo. Verás un badge naranja "Modo demo" en el header.

---

## 4. Deploy en Vercel (recomendado)

```bash
npm install -g vercel
vercel
```

En el dashboard de Vercel, agrega las variables de entorno del `.env`.

---

## Estructura del proyecto

```
src/
  components/
    Header.jsx          ← Header con indicador en vivo
    KpiCards.jsx        ← 4 tarjetas de resumen
    RankingPodio.jsx    ← Podio top 3 + tabla completa
    RankingProducto.jsx ← Gráfica de barras + lista
    TablaLeads.jsx      ← Tabla filtrable de leads
  hooks/
    useData.js          ← Hooks de datos + polling
  utils/
    mockData.js         ← Datos de ejemplo para desarrollo
  App.jsx               ← Layout principal
  index.css             ← Design tokens y estilos globales

n8n/
  workflow-ranking-asesores.json
  workflow-leads-contactados.json
  workflow-ranking-producto.json
```

---

## Estructura del JSON esperado de N8N

### /ranking-asesores
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

### /leads-contactados
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

### /ranking-producto
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

## Ajustes comunes

**Cambiar intervalo de refresco**: edita `VITE_REFRESH_INTERVAL` en `.env` (en ms).

**Cambiar el campo de producto**: en `workflow-ranking-producto.json` busca `tipo_producto` y cámbialo por tu API name real.

**Agregar asesor del día por monto** (en vez de por deals): en `useData.js`, cambia el sort de `asesorDelDia` a `a.monto`.

**Paginación de HubSpot**: si tienes más de 100 deals, agrega paginación en N8N usando el campo `paging.next.after` que devuelve la API.
