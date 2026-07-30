# Integrar llamadas de HubSpot en el flujo de n8n

El endpoint que usa el dashboard es:

`/webhook/hubspot-deals-dataset-optimizado`

Por eso el cambio debe hacerse en el nodo **Construir Dataset Optimizado**. No es
necesario modificar la rama antigua que comienza en el webhook con UUID.

## 1. Permisos requeridos

HubSpot no muestra un scope llamado `crm.objects.calls.read`. Para consultar
actividades de llamadas, la API actual acepta:

`crm.objects.contacts.read`

Este permiso ya está seleccionado en la aplicación de la captura. Conserva
también `crm.objects.deals.read` para poder relacionar las llamadas con los
negocios y `crm.objects.owners.read` para identificar al asesor.

No necesitas agregar otro permiso para probar la consulta. Si acabas de cambiar
algún scope, guarda la aplicación y actualiza la credencial/token utilizado por
n8n.

## 2. No dejes el token dentro del nodo

El JSON exportado contiene un token privado escrito directamente en el código.
Revócalo en HubSpot y reemplázalo por una credencial de n8n o una variable de
entorno. El código debe obtenerlo así:

```js
const token = $env.HUBSPOT_ACCESS_TOKEN;
```

## 3. Agregar esta función después de `searchDeals`

```js
async function searchCalls() {
  const calls = [];
  let after = null;

  do {
    const body = {
      filterGroups: [{
        filters: [
          { propertyName: 'hs_timestamp', operator: 'GTE', value: String(start.getTime()) },
          { propertyName: 'hs_timestamp', operator: 'LTE', value: String(end.getTime()) }
        ]
      }],
      properties: [
        'hs_timestamp',
        'hs_call_title',
        'hs_call_status',
        'hs_call_duration',
        'hs_call_direction',
        'hubspot_owner_id'
      ],
      limit: 100,
      sorts: [{ propertyName: 'hs_timestamp', direction: 'DESCENDING' }]
    };

    if (after) body.after = after;

    const data = await hubspotFetch('/crm/v3/objects/calls/search', {
      method: 'POST',
      body
    });

    calls.push(...(data.results || []));
    after = data.paging?.next?.after || null;
  } while (after);

  return calls;
}
```

## 4. Reemplazar la carga inicial

Reemplaza:

```js
const deals = await searchDeals();
const dealIds = deals.map(deal => String(deal.id));
```

por:

```js
const [deals, calls] = await Promise.all([
  searchDeals(),
  searchCalls()
]);

const dealIds = deals.map(deal => String(deal.id));
const callIds = calls.map(call => String(call.id));
```

## 5. Leer asociaciones de llamadas

En el `Promise.all` que ya obtiene owners, usuarios, etapas y asociaciones,
agrega las dos asociaciones nuevas:

```js
const [
  ownerMap,
  userMap,
  stageLabelMap,
  contactAssociations,
  lineItemAssociations,
  callContactAssociations,
  callDealAssociations
] = await Promise.all([
  getOwners(),
  getUsers(),
  getStageLabels(),
  batchReadAssociations('deals', 'contacts', dealIds),
  batchReadAssociations('deals', 'line_items', dealIds),
  batchReadAssociations('calls', 'contacts', callIds),
  batchReadAssociations('calls', 'deals', callIds)
]);
```

## 6. Construir el arreglo de llamadas

Antes de crear `payload`, agrega:

```js
const normalizedCalls = calls.map(call => {
  const props = call.properties || {};

  return {
    id: String(call.id),
    ownerId: props.hubspot_owner_id
      ? String(props.hubspot_owner_id)
      : null,
    timestamp: props.hs_timestamp || null,
    title: props.hs_call_title || null,
    status: props.hs_call_status || null,
    direction: props.hs_call_direction || null,
    duration: Number(props.hs_call_duration || 0),
    contactIds: callContactAssociations.get(String(call.id)) || [],
    dealIds: callDealAssociations.get(String(call.id)) || []
  };
});
```

## 7. Añadir llamadas a la respuesta

El objeto `payload` debe quedar con estos campos adicionales:

```js
const payload = {
  periodo,
  desdeISO: start.toISOString(),
  hastaISO: end.toISOString(),
  totalDeals: result.length,
  totalLineItems: lineItemIds.length,
  totalCalls: normalizedCalls.length,
  elapsedMs: Date.now() - startedAt,
  deals: result,
  calls: normalizedCalls
};
```

También puedes agregar `totalCalls: normalizedCalls.length` a
`staticData.lastBuild`.

## 8. Resultado esperado del webhook

```json
{
  "periodo": "mensual",
  "desdeISO": "2026-07-01T06:00:00.000Z",
  "hastaISO": "2026-08-01T05:59:59.999Z",
  "totalDeals": 166,
  "totalCalls": 42,
  "deals": [],
  "calls": [
    {
      "id": "123456",
      "ownerId": "98765",
      "timestamp": "2026-07-29T18:30:00.000Z",
      "title": "Seguimiento",
      "status": "COMPLETED",
      "direction": "OUTBOUND",
      "duration": 180000,
      "contactIds": ["111"],
      "dealIds": ["222"]
    }
  ]
}
```

El dashboard agrupa `calls` por `ownerId` para el asesor y por `contactIds` o
`dealIds` para cada cliente.
