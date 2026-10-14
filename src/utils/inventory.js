/** Inventory rows use id for the product record and batchNumber for the physical batch. */
const DAY_MS = 86400000

function calendarDay(value) {
  let year
  let month
  let day
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    year = value.getFullYear()
    month = value.getMonth() + 1
    day = value.getDate()
  } else if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (!match) return null
    ;[, year, month, day] = match.map(Number)
  } else return null
  const timestamp = Date.UTC(year, month - 1, day)
  const parsed = new Date(timestamp)
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day ? timestamp : null
}

/** Signed whole calendar days until expiry, or null when the date is invalid. */
export function getDaysUntilExpiry(expiryDate, today = new Date()) {
  const expiry = calendarDay(expiryDate)
  const current = calendarDay(today)
  return expiry === null || current === null ? null : (expiry - current) / DAY_MS
}

export function daysUntilExpiry(expiryDate, today = new Date()) {
  return getDaysUntilExpiry(expiryDate, today)
}

export function getExpiryStatus(item, today = new Date()) {
  const daysRemaining = getDaysUntilExpiry(item?.expiryDate, today)
  const status = daysRemaining === null ? 'Unknown' : daysRemaining <= 0 ? 'Expired' : daysRemaining <= 3 ? 'Critical' : daysRemaining <= 7 ? 'Warning' : 'Healthy'
  return { status, daysRemaining, expired: status === 'Expired', critical: status === 'Critical', warning: status === 'Warning' }
}

export function getStockStatus(item) {
  const { quantity, reorderLevel } = item ?? {}
  const valid = typeof quantity === 'number' && Number.isFinite(quantity) && quantity >= 0
    && typeof reorderLevel === 'number' && Number.isFinite(reorderLevel) && reorderLevel >= 0
  if (!valid) return { status: 'Unknown', lowStock: false }
  const lowStock = quantity <= reorderLevel
  return { status: lowStock ? 'Low stock' : 'Healthy', lowStock }
}

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

export function getInventoryAlerts(items, today = new Date()) {
  return items.map((item) => getInventoryAlert(item, today))
}

/** Expiring stock stays visible for removal; empty stock becomes a restock action. */
export function getBatchStatus(batch, today = new Date()) {
  const alert = getInventoryAlert(batch, today)
  if (alert.expiryStatus === 'Unknown' || alert.stockStatus === 'Unknown') return { label: 'Needs review', tone: 'review', action: 'Check missing or invalid inventory data', kind: 'review', alsoNeedsRestock: alert.lowStock }
  if (alert.expired && batch.quantity > 0) return { label: 'Expired', tone: 'danger', action: 'Remove from sale and review', kind: 'expiry', alsoNeedsRestock: !batch.reorderInitiated, alsoOrderStarted: Boolean(batch.reorderInitiated) }
  if (alert.critical && batch.quantity > 0) return { label: 'Critical', tone: 'critical', action: 'Sell first / consider discount', kind: 'expiry', alsoNeedsRestock: alert.lowStock && !batch.reorderInitiated, alsoOrderStarted: Boolean(batch.reorderInitiated) }
  if (alert.warning && batch.quantity > 0) return { label: 'Warning', tone: 'warning', action: 'Prioritize selling', kind: 'expiry', alsoNeedsRestock: alert.lowStock && !batch.reorderInitiated, alsoOrderStarted: Boolean(batch.reorderInitiated) }
  if (batch.reorderInitiated) return { label: 'Reorder started', tone: 'reorder', action: 'Order marked as started' }
  if (batch.quantity === 0) return { label: 'Low stock', tone: 'low', action: 'Reorder', kind: 'reorder' }
  if (batch.resolvedAt) return { label: 'Action complete', tone: 'complete', action: batch.resolutionNote || 'Reviewed' }
  if (alert.expired) return { label: 'Expired', tone: 'danger', action: 'Remove from sale and review', kind: 'expiry', alsoNeedsRestock: true }
  if (alert.critical) return { label: 'Critical', tone: 'critical', action: 'Sell first / consider discount', kind: 'expiry', alsoNeedsRestock: alert.lowStock }
  if (alert.warning) return { label: 'Warning', tone: 'warning', action: 'Prioritize selling', kind: 'expiry', alsoNeedsRestock: alert.lowStock }
  if (alert.lowStock) return { label: 'Low stock', tone: 'low', action: 'Reorder', kind: 'reorder' }
  return { label: 'Healthy', tone: 'healthy', action: 'No immediate action' }
}

export function getPriority(batch, today = new Date()) {
  const status = getBatchStatus(batch, today)
  const days = getDaysUntilExpiry(batch.expiryDate, today)
  if (status.kind === 'review') return batch.quantity === 0 && getStockStatus(batch).lowStock ? 40 : 20
  let score = 0
  if (status.kind === 'expiry' && days !== null) score += days <= 0 ? 100 : days <= 3 ? 80 - days * 8 : 55 - (days - 4) * 4
  if (getStockStatus(batch).lowStock && !batch.reorderInitiated) {
    const stockPriority = batch.quantity === 0 ? 40 : Math.min(39, 25 + Math.round((batch.reorderLevel - batch.quantity) / Math.max(batch.reorderLevel, 1) * 15))
    score += stockPriority
  }
  return Math.max(0, Math.min(100, score))
}

export function getAttentionBatches(batches, today = new Date()) {
  return batches
    .filter((batch) => ['Expired', 'Critical', 'Warning', 'Low stock', 'Needs review'].includes(getBatchStatus(batch, today).label))
    .sort((a, b) => getPriority(b, today) - getPriority(a, today) || String(a.batchNumber).localeCompare(String(b.batchNumber)))
}

export function getSellFirstItems(items, today = new Date()) {
  return items.map((item, index) => ({ item: getInventoryAlert(item, today), index }))
    .filter(({ item }) => item.expired || item.critical || item.warning)
    .sort((a, b) => {
      const rank = (item) => item.expired ? 0 : item.critical ? 1 : 2
      return rank(a.item) - rank(b.item) || (a.item.daysUntilExpiry ?? Number.MAX_SAFE_INTEGER) - (b.item.daysUntilExpiry ?? Number.MAX_SAFE_INTEGER)
        || String(a.item.id).localeCompare(String(b.item.id)) || a.index - b.index
    }).map(({ item }) => item)
}

export function getReorderNowItems(items, today = new Date()) {
  return items.map((item, index) => ({ item: getInventoryAlert(item, today), index }))
    .filter(({ item }) => item.lowStock)
    .sort((a, b) => (a.item.quantity - a.item.reorderLevel) - (b.item.quantity - b.item.reorderLevel)
      || String(a.item.id).localeCompare(String(b.item.id)) || a.index - b.index)
    .map(({ item }) => item)
}

export function estimateExposure(batches, today = new Date()) {
  return batches.reduce((total, batch) => {
    const status = getBatchStatus(batch, today)
    const cost = Number(batch.costPrice)
    return ['Expired', 'Critical', 'Warning'].includes(status.label) && Number.isFinite(cost) && cost >= 0 && Number.isFinite(batch.quantity) && batch.quantity >= 0
      ? total + batch.quantity * cost : total
  }, 0)
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

export function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)
}
