import { useState } from 'react'
import { daysUntilExpiry, formatCurrency, getBatchStatus } from '../utils/inventory'
import { getFriendlyStatusLabel } from '../utils/statusLabels'

export default function BatchActionModal({ batch, today, onClose, onEdit, onUpdate }) {
  const [quantity, setQuantity] = useState(1)
  const [confirmation, setConfirmation] = useState(false)
  const status = getBatchStatus(batch, today)
  const days = daysUntilExpiry(batch.expiryDate, new Date(`${today}T00:00:00`))
  const expired = status.label === 'Expired' && batch.quantity > 0
  const isReorder = status.kind === 'reorder' || (Boolean(batch.reorderInitiated) && status.kind !== 'expiry' && status.kind !== 'review')
  const needsReview = status.kind === 'review'
  const alreadyHandled = Boolean(status.kind !== 'expiry' && status.kind !== 'review' && ((batch.resolvedAt && batch.quantity > 0) || batch.reorderInitiated))
  const saveSale = () => {
    if (!confirmation) { setConfirmation(true); return }
    onUpdate(batch.batchNumber, { quantity: Math.max(0, batch.quantity - Number(quantity)), resolvedAt: batch.quantity - Number(quantity) <= 0 ? today : null, resolutionNote: `Recorded ${quantity} ${batch.unit} sold` })
  }
  const completeExpired = () => onUpdate(batch.batchNumber, { quantity: 0, resolvedAt: today, resolutionNote: 'Removed from sale' })
  const initiateReorder = () => onUpdate(batch.batchNumber, { reorderInitiated: true })

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="action-modal" role="dialog" aria-modal="true" aria-labelledby="action-title">
    <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
    <div className={`modal-symbol ${status.tone}`}>{alreadyHandled ? '✓' : needsReview ? '!' : isReorder ? '↗' : expired ? '!' : '◷'}</div>
    <div className="modal-eyebrow">DELIVERY {batch.batchNumber}</div><h2 id="action-title">{alreadyHandled ? getFriendlyStatusLabel(status) : needsReview ? 'Check stock details' : isReorder ? `Restock ${batch.name}` : expired ? 'Remove expired stock' : 'Record a sale'}</h2>
    <p className="modal-description">{alreadyHandled ? batch.reorderInitiated ? `${batch.name}: Order marked as started.` : `${batch.name}: ${batch.resolutionNote || 'This stock is marked done.'}` : needsReview ? `${batch.name} is missing a quantity, restock level, or use-by date. Update its details before taking action.` : isReorder ? `${batch.name} is at or below the restock point. After you start an order, mark it here to clear this reminder.` : expired ? `${batch.name} ${days === 0 ? 'reaches its use-by date today' : `expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`}. Remove it from sale to keep it off the shelf.` : `${batch.name} expires ${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`}. Record how many you sold to update the stock count.`}</p>
    <div className="batch-facts"><div><span>In stock</span><strong>{batch.quantity} {batch.unit}</strong></div><div><span>Use by</span><strong>{new Date(`${batch.expiryDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></div><div><span>Buy cost</span><strong>{formatCurrency(batch.quantity * batch.costPrice)}</strong></div></div>
    {!alreadyHandled && !needsReview && (isReorder ? <div className="reorder-details"><span>Restock when at</span><strong>{batch.reorderLevel} {batch.unit}</strong><span>Suggested order amount</span><strong>{Math.max(batch.reorderLevel * 2 - batch.quantity, batch.reorderLevel)} {batch.unit}</strong><small>Suggested to bring stock up to twice the restock level.</small></div> : expired ? <div className="confirm-box"><strong>Remove this stock from sale?</strong><span>This marks the batch as removed and sets its available quantity to zero.</span></div> : <label className="quantity-field">How many have you sold?<input type="number" min="1" max={batch.quantity} value={quantity} onChange={(event) => { setQuantity(Math.max(1, Math.min(batch.quantity, Number(event.target.value)))) }} /><span>Stock left after sale: {Math.max(0, batch.quantity - Number(quantity))} {batch.unit}</span></label>)}
    {confirmation && !alreadyHandled && !needsReview && !isReorder && !expired && <div className="confirm-box"><strong>Record {quantity} {batch.unit} as sold?</strong><span>This will reduce stock and update today’s list right away.</span></div>}
    <div className="modal-actions">{!alreadyHandled && !needsReview && <button className="secondary-button" onClick={onClose}>Cancel</button>}<button className="primary-button" onClick={alreadyHandled ? onClose : needsReview ? onEdit : isReorder ? initiateReorder : expired ? completeExpired : saveSale}>{alreadyHandled ? 'Done' : needsReview ? 'Change details' : isReorder ? 'Mark order started' : expired ? 'Remove from sale' : confirmation ? 'Confirm sale' : 'Continue'}</button></div>
  </section></div>
}
