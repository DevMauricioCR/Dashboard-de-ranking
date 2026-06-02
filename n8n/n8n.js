const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
const BASE_URL = 'https://api.hubapi.com';

if (!HUBSPOT_ACCESS_TOKEN) {
  throw new Error('Falta la variable de entorno HUBSPOT_ACCESS_TOKEN');
}

async function hubspotFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error ${res.status} en ${path}: ${errorText}`);
  }

  return res.json();
}

async function getAllDeals() {
  const allDeals = [];
  let after = null;

  do {
    const params = new URLSearchParams({
      limit: '100',
      properties: 'dealname,amount,dealstage,pipeline,closedate,createdate,hs_lastmodifieddate,hubspot_owner_id',
      associations: 'contacts,line_items'
    });

    if (after) params.append('after', after);

    const data = await hubspotFetch(`/crm/v3/objects/deals?${params.toString()}`);
    allDeals.push(...(data.results || []));
    after = data?.paging?.next?.after || null;
  } while (after);

  return allDeals;
}

async function getOwners() {
  const owners = [];
  let after = null;

  do {
    const params = new URLSearchParams({
      limit: '100'
    });

    if (after) params.append('after', after);

    const data = await hubspotFetch(`/crm/v3/owners/?${params.toString()}`);
    owners.push(...(data.results || []));
    after = data?.paging?.next?.after || null;
  } while (after);

  const ownerMap = new Map();

  for (const owner of owners) {
    if (owner.id) ownerMap.set(String(owner.id), owner);
    if (owner.userId) ownerMap.set(String(owner.userId), owner);
  }

  return ownerMap;
}

async function getStageLabels() {
  const stageMap = new Map();
  const data = await hubspotFetch('/crm/v3/pipelines/deals');

  for (const pipeline of data.results || []) {
    for (const stage of pipeline.stages || []) {
      if (stage.id) stageMap.set(String(stage.id), stage.label || stage.id);
    }
  }

  return stageMap;
}

function getAssociationIds(record, associationType) {
  return (record.associations?.[associationType]?.results || []).map(item => item.id);
}

function chunkArray(arr, size = 100) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function batchReadContacts(contactIds) {
  if (!contactIds.length) return new Map();

  const uniqueIds = [...new Set(contactIds.map(String))];
  const chunks = chunkArray(uniqueIds, 100);
  const contactMap = new Map();

  for (const chunk of chunks) {
    const data = await hubspotFetch('/crm/v3/objects/contacts/batch/read', {
      method: 'POST',
      body: JSON.stringify({
        properties: ['firstname', 'lastname', 'email', 'phone', 'company'],
        inputs: chunk.map(id => ({ id }))
      })
    });

    for (const contact of data.results || []) {
      contactMap.set(String(contact.id), contact);
    }
  }

  return contactMap;
}

async function batchReadLineItems(lineItemIds) {
  if (!lineItemIds.length) return new Map();

  const uniqueIds = [...new Set(lineItemIds.map(String))];
  const chunks = chunkArray(uniqueIds, 100);
  const lineItemMap = new Map();

  for (const chunk of chunks) {
    const data = await hubspotFetch('/crm/v3/objects/line_items/batch/read', {
      method: 'POST',
      body: JSON.stringify({
        properties: ['name', 'quantity', 'price', 'amount', 'hs_product_id', 'sku'],
        inputs: chunk.map(id => ({ id }))
      })
    });

    for (const lineItem of data.results || []) {
      lineItemMap.set(String(lineItem.id), lineItem);
    }
  }

  return lineItemMap;
}

async function batchReadAssociations(fromObjectType, toObjectType, fromIds) {
  if (!fromIds.length) return new Map();

  const associationMap = new Map();
  const uniqueIds = [...new Set(fromIds.map(String))];
  const chunks = chunkArray(uniqueIds, 100);

  for (const chunk of chunks) {
    const data = await hubspotFetch(`/crm/v4/associations/${fromObjectType}/${toObjectType}/batch/read`, {
      method: 'POST',
      body: JSON.stringify({
        inputs: chunk.map(id => ({ id }))
      })
    });

    for (const result of data.results || []) {
      const fromId = String(result.from?.id || result._from?.id || result.id || '');
      const toIds = (result.to || [])
        .map(item => String(item.toObjectId || item.id || ''))
        .filter(Boolean);

      if (fromId) associationMap.set(fromId, toIds);
    }
  }

  return associationMap;
}

async function buildDealsDataset() {
  const deals = await getAllDeals();
  const [ownerMap, stageLabelMap] = await Promise.all([
    getOwners(),
    getStageLabels()
  ]);
  const dealIds = deals.map(deal => String(deal.id));
  const lineItemAssociations = await batchReadAssociations('deals', 'line_items', dealIds);

  const allContactIds = deals.flatMap(deal => getAssociationIds(deal, 'contacts'));
  const allLineItemIds = [...lineItemAssociations.values()].flat();

  const [contactMap, lineItemMap] = await Promise.all([
    batchReadContacts(allContactIds),
    batchReadLineItems(allLineItemIds)
  ]);

  return deals.map(deal => {
    const props = deal.properties || {};
    const ownerId = props.hubspot_owner_id ? String(props.hubspot_owner_id) : null;

    const contacts = getAssociationIds(deal, 'contacts')
      .map(id => contactMap.get(String(id)))
      .filter(Boolean)
      .map(contact => ({
        id: contact.id,
        firstname: contact.properties?.firstname || null,
        lastname: contact.properties?.lastname || null,
        email: contact.properties?.email || null,
        phone: contact.properties?.phone || null,
        company: contact.properties?.company || null
      }));

    const lineItems = (lineItemAssociations.get(String(deal.id)) || [])
      .map(id => lineItemMap.get(String(id)))
      .filter(Boolean)
      .map(item => ({
        id: item.id,
        name: item.properties?.name || null,
        quantity: item.properties?.quantity || null,
        price: item.properties?.price || null,
        amount: item.properties?.amount || null,
        hs_product_id: item.properties?.hs_product_id || null,
        sku: item.properties?.sku || null
      }));

    const owner = ownerId ? ownerMap.get(ownerId) || null : null;

    return {
      dealId: deal.id,
      dealName: props.dealname || null,
      amount: props.amount || null,
      dealStage: props.dealstage || null,
      dealStageLabel: props.dealstage ? stageLabelMap.get(String(props.dealstage)) || null : null,
      pipeline: props.pipeline || null,
      closeDate: props.closedate || null,
      createDate: props.createdate || null,
      lastModifiedDate: props.hs_lastmodifieddate || null,
      hubspotOwnerId: ownerId,
      owner: owner
        ? {
            id: owner.id || null,
            userId: owner.userId || null,
            firstName: owner.firstName || null,
            lastName: owner.lastName || null,
            email: owner.email || null
          }
        : null,
      contacts,
      lineItems
    };
  });
}

async function main() {
  const result = await buildDealsDataset();
  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
