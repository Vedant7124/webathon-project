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
