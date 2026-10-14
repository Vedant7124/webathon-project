import { formatCurrency, getBatchStatus, getPriority, daysUntilExpiry } from '../utils/inventory'

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function ActionQueue({ batches, today, onSelect }) {
  if (!batches.length) return <div className="queue-empty"><span className="empty-check">✓</span><div><strong>All clear for today</strong><p>There are no expiry or reorder actions waiting.</p></div></div>
  return <div className="action-queue">
    {batches.map((batch, index) => {
      const status = getBatchStatus(batch, today)
      const score = getPriority(batch, today)
      const days = daysUntilExpiry(batch.expiryDate, new Date(`${today}T00:00:00`))
      const reason = status.kind === 'reorder'
        ? `${batch.quantity} ${batch.unit} left · reorder at ${batch.reorderLevel}`
        : days < 0 ? `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago · remove from shelf`
          : `Expires ${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`} · ${batch.quantity} ${batch.unit} in this batch`
      return <article className={`action-item ${status.tone}`} key={batch.batchNumber}>
        <div className="queue-rank">{String(index + 1).padStart(2, '0')}</div>
        <div className="action-item-main"><div className="action-title-row"><strong>{batch.name}</strong><span className={`status-pill ${status.tone}`}><i/>{status.label}</span></div><span className="batch-meta">Batch {batch.batchNumber} <b>·</b> {reason}</span><div className="action-meter"><span style={{ width: `${score}%` }}/></div><div className="action-item-foot"><span>Priority <b>{score}/100</b></span>{status.kind !== 'reorder' && <span>Cost at risk <b>{formatCurrency(batch.quantity * batch.costPrice)}</b></span>}</div></div>
        <button className="queue-action" onClick={() => onSelect(batch)}>{status.kind === 'reorder' ? 'Review reorder' : 'Take action'} <span>→</span></button>
        <span className="queue-date">{status.kind === 'reorder' ? 'STOCK' : formatDate(batch.expiryDate)}</span>
      </article>
    })}
  </div>
}
