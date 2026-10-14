import { useState } from 'react'
import { daysUntilExpiry, formatCurrency, getBatchStatus } from '../utils/inventory'

export default function BatchActionModal({ batch, today, onClose, onUpdate }) {
  const [quantity, setQuantity] = useState(1)
  const [confirmation, setConfirmation] = useState(false)
  const status = getBatchStatus(batch, today)
  const days = daysUntilExpiry(batch.expiryDate, new Date(`${today}T00:00:00`))
  const isReorder = status.kind === 'reorder' || Boolean(batch.reorderInitiated)
  const alreadyHandled = Boolean(batch.resolvedAt || batch.reorderInitiated)
  const expired = days < 0
  const saveSale = () => {
    if (!confirmation) { setConfirmation(true); return }
    onUpdate(batch.batchNumber, { quantity: Math.max(0, batch.quantity - Number(quantity)), resolvedAt: batch.quantity - Number(quantity) <= 0 ? today : null, resolutionNote: `Recorded ${quantity} ${batch.unit} sold` })
  }
  const completeExpired = () => onUpdate(batch.batchNumber, { quantity: 0, resolvedAt: today, resolutionNote: 'Removed from sale' })
  const initiateReorder = () => onUpdate(batch.batchNumber, { reorderInitiated: true })

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="action-modal" role="dialog" aria-modal="true" aria-labelledby="action-title">
    <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
    <div className={`modal-symbol ${status.tone}`}>{alreadyHandled ? '✓' : isReorder ? '↗' : expired ? '!' : '◷'}</div>
    <div className="modal-eyebrow">BATCH {batch.batchNumber}</div><h2 id="action-title">{alreadyHandled ? status.label : isReorder ? 'Reorder this item' : expired ? 'Remove expired stock' : `Prioritize ${batch.name}`}</h2>
    <p className="modal-description">{alreadyHandled ? `${batch.name}: ${status.action}. This batch has already been recorded.` : isReorder ? `${batch.name} is below its reorder level. Record that replenishment has been initiated.` : expired ? `${batch.name} expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago. Remove this batch from sale to keep it off the shelf.` : `${batch.name} expires ${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`}. Record units sold to update the live stock count.`}</p>
    <div className="batch-facts"><div><span>On hand</span><strong>{batch.quantity} {batch.unit}</strong></div><div><span>Expiry</span><strong>{new Date(`${batch.expiryDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></div><div><span>Cost exposure</span><strong>{formatCurrency(batch.quantity * batch.costPrice)}</strong></div></div>
    {!alreadyHandled && (isReorder ? <div className="reorder-details"><span>Reorder level</span><strong>{batch.reorderLevel} {batch.unit}</strong><span>Suggested order quantity</span><strong>{Math.max(batch.reorderLevel * 2 - batch.quantity, batch.reorderLevel)} {batch.unit}</strong></div> : expired ? <div className="confirm-box"><strong>Confirm removal from sale</strong><span>This records the batch as removed and sets its available quantity to zero.</span></div> : <label className="quantity-field">Units sold or discounted<input type="number" min="1" max={batch.quantity} value={quantity} onChange={(event) => { setQuantity(Math.max(1, Math.min(batch.quantity, Number(event.target.value)))) }} /><span>Remaining after action: {Math.max(0, batch.quantity - Number(quantity))} {batch.unit}</span></label>)}
    {confirmation && !alreadyHandled && !isReorder && !expired && <div className="confirm-box"><strong>Record {quantity} {batch.unit} as sold?</strong><span>This will reduce available stock and update the dashboard immediately.</span></div>}
    <div className="modal-actions">{!alreadyHandled && <button className="secondary-button" onClick={onClose}>Cancel</button>}<button className="primary-button" onClick={alreadyHandled ? onClose : isReorder ? initiateReorder : expired ? completeExpired : saveSale}>{alreadyHandled ? 'Done' : isReorder ? 'Mark reorder initiated' : expired ? 'Confirm removal' : confirmation ? 'Confirm sale' : 'Review sale'}</button></div>
  </section></div>
}
