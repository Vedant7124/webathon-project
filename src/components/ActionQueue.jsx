import { formatCurrency, getBatchStatus, daysUntilExpiry } from '../utils/inventory'
import { getFriendlyStatusBadges } from '../utils/statusLabels'

export default function ActionQueue({ batches, today, onSelect }) {
  if (!batches.length) return <div className="queue-empty"><span className="empty-check">✓</span><div><strong>Nothing needs attention</strong><p>No items need selling soon or restocking.</p></div></div>
  return <div className="action-queue">
    {batches.map((batch) => {
      const status = getBatchStatus(batch, today)
      const days = daysUntilExpiry(batch.expiryDate, new Date(`${today}T00:00:00`))
      const reason = status.kind === 'review'
        ? 'Stock details need checking before we can recommend an action.'
        : status.kind === 'reorder'
        ? `${batch.quantity} ${batch.unit} in stock · restock when at ${batch.reorderLevel}`
        : days === null ? status.action : status.label === 'Expired' ? days === 0 ? 'Use-by date is today · remove from shelf' : `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago · remove from shelf`
          : `Expires ${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`} · ${batch.quantity} ${batch.unit} in stock`
      return <article className={`action-item ${status.tone}`} key={batch.batchNumber}>
        <div className="action-item-main"><div className="action-title-row"><strong>{batch.name}</strong><span className="status-list">{getFriendlyStatusBadges(status).map((badge) => <span className={`status-pill ${badge.tone}`} key={badge.label}><i/>{badge.label}</span>)}</span></div><span className="batch-meta">Delivery {batch.batchNumber} <b>·</b> {reason}</span><div className="action-item-foot">{status.kind === 'expiry' && <span>Buy cost of this stock <b>{formatCurrency(batch.quantity * batch.costPrice)}</b></span>}</div></div>
        <button className="queue-action" onClick={() => onSelect(batch)}>{status.kind === 'reorder' ? 'View restock options' : status.kind === 'review' ? 'Check details' : status.label === 'Expired' ? 'Remove from sale' : 'Record a sale'} <span>→</span></button>
      </article>
    })}
  </div>
}
