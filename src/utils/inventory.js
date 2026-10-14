export function daysUntilExpiry(expiryDate, today = new Date()) {
  const todayString = typeof today === 'string' ? today : today.toISOString().slice(0, 10)
  const currentDate = new Date(`${todayString}T00:00:00`)
  return Math.ceil((new Date(`${expiryDate}T00:00:00`) - currentDate) / 86400000)
}

export function getBatchStatus(batch, today) {
  if (batch.reorderInitiated) return { label: 'Reorder started', tone: 'reorder', action: 'Replenishment is being tracked' }
  if (batch.resolvedAt) return { label: 'Action complete', tone: 'complete', action: batch.resolutionNote || 'Reviewed' }
  const days = daysUntilExpiry(batch.expiryDate, today)
  if (days < 0) return { label: 'Expired', tone: 'danger', action: 'Remove from sale and review', kind: 'expiry' }
  if (days <= 3) return { label: 'Critical', tone: 'critical', action: 'Sell first / consider discount', kind: 'expiry' }
  if (days <= 7) return { label: 'Warning', tone: 'warning', action: 'Prioritize selling', kind: 'expiry' }
  if (batch.quantity <= batch.reorderLevel) return { label: 'Low stock', tone: 'low', action: 'Reorder', kind: 'reorder' }
  return { label: 'Healthy', tone: 'healthy', action: 'No immediate action' }
}

export function getPriority(batch, today) {
  const status = getBatchStatus(batch, today)
  const days = daysUntilExpiry(batch.expiryDate, new Date(`${today}T00:00:00`))
  let score = 0
  if (status.kind === 'expiry') score += days < 0 ? 100 : days <= 3 ? 80 - Math.max(days, 0) * 8 : 55 - (days - 4) * 4
  if (batch.quantity <= batch.reorderLevel && !batch.reorderInitiated) score += 25 + Math.round((batch.reorderLevel - batch.quantity) / Math.max(batch.reorderLevel, 1) * 15)
  return Math.max(0, Math.min(100, score))
}

export function getAttentionBatches(batches, today) {
  return batches
    .filter((batch) => ['Expired', 'Critical', 'Warning', 'Low stock'].includes(getBatchStatus(batch, today).label))
    .sort((a, b) => getPriority(b, today) - getPriority(a, today))
}

export function estimateExposure(batches, today) {
  return batches.reduce((total, batch) => {
    const status = getBatchStatus(batch, today)
    return ['Expired', 'Critical', 'Warning'].includes(status.label) ? total + batch.quantity * batch.costPrice : total
  }, 0)
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)
}
