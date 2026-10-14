/**
 * InventoryItem: { id, name, category, batchNumber, quantity, unit, reorderLevel,
 * expiryDate (YYYY-MM-DD), costPrice, sellingPrice }. Each id identifies one row.
 */

const DAY_MS = 86400000

function calendarDay(value) {
  let year
  let month
  let day
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    // Use the local calendar date for "today", independent of elapsed time or DST.
    year = value.getFullYear()
    month = value.getMonth() + 1
    day = value.getDate()
  } else if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (!match) return null
    ;[, year, month, day] = match.map(Number)
  } else {
    return null
  }
  const timestamp = Date.UTC(year, month - 1, day)
  const parsed = new Date(timestamp)
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null
  return timestamp
}

/** Returns signed calendar days until expiry, or null for a missing/invalid date. */
export function getDaysUntilExpiry(expiryDate, today = new Date()) {
  const expiry = calendarDay(expiryDate)
  const current = calendarDay(today)
  if (expiry === null || current === null) return null
  return (expiry - current) / DAY_MS
}

/** Expiry status is independent from stock status. The expiry date itself is expired. */
export function getExpiryStatus(item, today = new Date()) {
  const daysRemaining = getDaysUntilExpiry(item?.expiryDate, today)
  const status = daysRemaining === null
    ? 'Unknown'
    : daysRemaining <= 0
      ? 'Expired'
      : daysRemaining <= 3
        ? 'Critical'
        : daysRemaining <= 7
          ? 'Warning'
          : 'Healthy'
  return {
    status,
    daysRemaining,
    expired: status === 'Expired',
    critical: status === 'Critical',
    warning: status === 'Warning',
  }
}

/** Stock status is independent from expiry status; invalid numbers are Unknown. */
export function getStockStatus(item) {
  const quantity = item?.quantity
  const reorderLevel = item?.reorderLevel
  const valid = typeof quantity === 'number' && Number.isFinite(quantity) && quantity >= 0
    && typeof reorderLevel === 'number' && Number.isFinite(reorderLevel) && reorderLevel >= 0
  if (!valid) return { status: 'Unknown', lowStock: false }
  const lowStock = quantity <= reorderLevel
  return { status: lowStock ? 'Low stock' : 'Healthy', lowStock }
}

/** Calculate expiry and stock independently for one inventory row. */
export function getInventoryAlert(item, today = new Date()) {
  const expiry = getExpiryStatus(item, today)
  const stock = getStockStatus(item)
  return {
    ...item,
    daysUntilExpiry: expiry.daysRemaining,
    expiryStatus: expiry.status,
    stockStatus: stock.status,
    expired: expiry.expired,
    critical: expiry.critical,
    warning: expiry.warning,
    lowStock: stock.lowStock,
    healthy: expiry.status === 'Healthy' && stock.status === 'Healthy',
  }
}

/** Expired rows are first for removal; only non-expired rows are sell recommendations. */
export function getSellFirstItems(items, today = new Date()) {
  return items
    .map((item, index) => ({ item: getInventoryAlert(item, today), index }))
    .filter(({ item }) => item.expired || item.critical || item.warning)
    .sort((a, b) => {
      const urgency = (item) => item.expired ? 0 : item.critical ? 1 : 2
      return urgency(a.item) - urgency(b.item)
        || (a.item.daysUntilExpiry ?? Number.MAX_SAFE_INTEGER) - (b.item.daysUntilExpiry ?? Number.MAX_SAFE_INTEGER)
        || String(a.item.id).localeCompare(String(b.item.id))
        || a.index - b.index
    })
    .map(({ item }) => item)
}

export function getReorderNowItems(items, today = new Date()) {
  return items
    .map((item, index) => ({ item: getInventoryAlert(item, today), index }))
    .filter(({ item }) => item.lowStock)
    .sort((a, b) => (a.item.quantity - a.item.reorderLevel) - (b.item.quantity - b.item.reorderLevel)
      || String(a.item.id).localeCompare(String(b.item.id))
      || a.index - b.index)
    .map(({ item }) => item)
}

/** Array form used by alert components; invalid/missing data is marked Unknown. */
export function getInventoryAlerts(items, today = new Date()) {
  return items.map((item) => getInventoryAlert(item, today))
}

export function createInventoryId(existingIds = []) {
  const used = new Set(existingIds)
  let id
  do {
    id = globalThis.crypto?.randomUUID
      ? `P${globalThis.crypto.randomUUID().replaceAll('-', '').toUpperCase()}`
      : `P${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 12).toUpperCase()}`
  } while (used.has(id))
  return id
}
