const inventoryEndpoint = '/api/inventory'

export class InventoryApiError extends Error {
  constructor(message, { status, latest } = {}) {
    super(message)
    this.name = 'InventoryApiError'
    this.status = status
    this.latest = latest
  }
}

async function requestInventory(url, options) {
  let response
  try {
    response = await fetch(url, { ...options, cache: 'no-store' })
  } catch {
    throw new InventoryApiError('Could not reach the shared inventory service.')
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new InventoryApiError('The inventory service returned an unreadable response.', { status: response.status })
  }

  if (!response.ok) {
    throw new InventoryApiError(payload.error || 'The inventory request failed.', {
      status: response.status,
      latest: payload.latest,
    })
  }
  return payload
}

export function loadSharedInventory() {
  return requestInventory(inventoryEndpoint, { method: 'GET' })
}

export function saveSharedInventory(batches, version) {
  if (!version) throw new InventoryApiError('The shared inventory version is not ready yet.')
  return requestInventory(inventoryEndpoint, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      'x-inventory-version': version,
    },
    body: JSON.stringify({ batches }),
  })
}
