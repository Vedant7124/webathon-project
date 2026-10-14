const FRIENDLY_STATUS_LABELS = {
  danger: 'Expired',
  critical: 'Sell first',
  warning: 'Sell soon',
  low: 'Restock',
  healthy: 'In good shape',
  reorder: 'Order started',
  complete: 'Done',
  review: 'Check details',
}

export function getFriendlyStatusLabel(status) {
  return FRIENDLY_STATUS_LABELS[status.tone] ?? status.label
}

export function getFriendlyStatusBadges(status) {
  const badges = [{ label: getFriendlyStatusLabel(status), tone: status.tone }]
  if (status.alsoNeedsRestock) badges.push({ label: 'Restock', tone: 'low' })
  if (status.alsoOrderStarted) badges.push({ label: 'Order started', tone: 'reorder' })
  return badges
}
