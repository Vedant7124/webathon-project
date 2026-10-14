import { getStore } from '@netlify/blobs'
import { randomUUID } from 'node:crypto'
import { demoInventory } from '../../src/data/demoInventory.js'

const store = getStore({ name: 'smartstock-inventory', consistency: 'strong' })
const inventoryKey = 'shared-batches'
const maxBatches = 2000

function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...headers,
    },
  })
}

function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function validateBatches(value) {
  if (!Array.isArray(value)) return { error: 'Inventory must be an array of batches.' }
  if (value.length > maxBatches) return { error: `Inventory cannot contain more than ${maxBatches} batches.` }

  const seenBatchNumbers = new Set()
  const batches = []

  for (const [index, batch] of value.entries()) {
    const label = `Batch ${index + 1}`
    if (!batch || typeof batch !== 'object' || Array.isArray(batch)) {
      return { error: `${label} must be an object.` }
    }

    for (const [field, maxLength] of [['id', 100], ['name', 120], ['category', 80], ['batchNumber', 80], ['unit', 40]]) {
      if (typeof batch[field] !== 'string' || !batch[field].trim() || batch[field].trim().length > maxLength) {
        return { error: `${label} needs a valid ${field} (up to ${maxLength} characters).` }
      }
    }

    const batchKey = batch.batchNumber.trim().toLocaleLowerCase('en')
    if (seenBatchNumbers.has(batchKey)) return { error: `Batch number ${batch.batchNumber} is already in use.` }
    seenBatchNumbers.add(batchKey)

    for (const field of ['quantity', 'reorderLevel', 'costPrice', 'sellingPrice']) {
      if (typeof batch[field] !== 'number' || !Number.isFinite(batch[field]) || batch[field] < 0) {
        return { error: `${label} needs a non-negative number for ${field}.` }
      }
    }
    if (!isCalendarDate(batch.expiryDate)) return { error: `${label} needs a valid expiry date in YYYY-MM-DD format.` }
    if (batch.resolvedAt != null && !isCalendarDate(batch.resolvedAt)) return { error: `${label} has an invalid action date.` }
    if (batch.resolutionNote != null && (typeof batch.resolutionNote !== 'string' || batch.resolutionNote.length > 200)) {
      return { error: `${label} has an invalid action note.` }
    }
    if (batch.reorderInitiated != null && typeof batch.reorderInitiated !== 'boolean') {
      return { error: `${label} has an invalid reorder status.` }
    }

    const cleanBatch = {
      id: batch.id.trim(),
      name: batch.name.trim(),
      category: batch.category.trim(),
      batchNumber: batch.batchNumber.trim(),
      quantity: batch.quantity,
      unit: batch.unit.trim(),
      reorderLevel: batch.reorderLevel,
      expiryDate: batch.expiryDate,
      costPrice: batch.costPrice,
      sellingPrice: batch.sellingPrice,
    }
    if (batch.resolvedAt != null) cleanBatch.resolvedAt = batch.resolvedAt
    if (batch.resolutionNote != null) cleanBatch.resolutionNote = batch.resolutionNote
    if (batch.reorderInitiated != null) cleanBatch.reorderInitiated = batch.reorderInitiated
    batches.push(cleanBatch)
  }

  return { batches }
}

async function readInventory() {
  let entry = await store.getWithMetadata(inventoryKey, { type: 'json' })
  if (!entry) {
    await store.setJSON(inventoryKey, {
      batches: demoInventory,
      isSeedData: true,
      version: randomUUID(),
      updatedAt: new Date().toISOString(),
    }, { onlyIfNew: true })
    entry = await store.getWithMetadata(inventoryKey, { type: 'json' })
  }
  if (!entry) throw new Error('Inventory could not be initialized.')

  if (!entry.data.version) {
    const upgraded = {
      ...entry.data,
      isSeedData: Boolean(entry.data.isSeedData),
      version: randomUUID(),
      updatedAt: entry.data.updatedAt || new Date().toISOString(),
    }
    const result = await store.setJSON(inventoryKey, upgraded, entry.etag ? { onlyIfMatch: entry.etag } : {})
    if (!result.modified) return readInventory()
    entry = await store.getWithMetadata(inventoryKey, { type: 'json' })
  }
  return entry
}

function formatInventory(entry) {
  return {
    batches: entry.data.batches,
    version: entry.data.version || entry.etag,
    isSeedData: Boolean(entry.data.isSeedData),
    updatedAt: entry.data.updatedAt,
  }
}

function conflictResponse(entry) {
  return jsonResponse({
    error: 'Inventory changed in another session. The latest shared inventory is included.',
    latest: formatInventory(entry),
  }, 409)
}

export default async function inventoryHandler(request) {
  try {
    if (request.method === 'GET') {
      const entry = await readInventory()
      if (!entry.data || !Array.isArray(entry.data.batches)) {
        return jsonResponse({ error: 'Stored inventory is invalid.' }, 500)
      }
    return jsonResponse(formatInventory(entry))
    }

    if (request.method !== 'PUT') {
      return jsonResponse({ error: 'Method not allowed.' }, 405, { allow: 'GET, PUT' })
    }

    if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
      return jsonResponse({ error: 'Send inventory as application/json.' }, 415)
    }

    const expectedVersion = request.headers.get('x-inventory-version')
    if (!expectedVersion) return jsonResponse({ error: 'A current inventory version is required.' }, 428)

    let payload
    try {
      payload = await request.json()
    } catch {
      return jsonResponse({ error: 'Request body must be valid JSON.' }, 400)
    }

    const validation = validateBatches(payload?.batches)
    if (validation.error) return jsonResponse({ error: validation.error }, 422)

    const current = await readInventory()
    if (formatInventory(current).version !== expectedVersion) return conflictResponse(current)

    const nextData = {
      batches: validation.batches,
      isSeedData: false,
      version: randomUUID(),
      updatedAt: new Date().toISOString(),
    }
    // Blobs ETags provide the atomic compare-and-swap in production. Local emulation
    // currently omits ETags, so the application revision still keeps the API usable.
    const result = await store.setJSON(inventoryKey, nextData, current.etag ? { onlyIfMatch: current.etag } : {})
    if (!result.modified) return conflictResponse(await readInventory())

    return jsonResponse(nextData)
  } catch (error) {
    console.error('SmartStock inventory function failed:', error)
    return jsonResponse({ error: 'Inventory service is temporarily unavailable.' }, 500)
  }
}

export const config = { path: '/api/inventory' }
