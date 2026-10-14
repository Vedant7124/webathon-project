import { getBatchStatus } from '../utils/inventory'
import { getFriendlyStatusLabel } from '../utils/statusLabels'

export default function InventoryTable({ batches, today, onSelect, onAdd }) {
  return <section className="panel inventory-panel" id="inventory">
    <div className="panel-heading"><div><h2>Stock on hand</h2><p>One row is one delivery. Select a row to see what you can do.</p></div><div className="table-heading-actions"><span className="table-count">{batches.length} items</span><button className="primary-button table-add-button" type="button" onClick={onAdd}>+ Add stock</button></div></div>
    <div className="table-wrap"><table><thead><tr><th>ITEM</th><th>IN STOCK</th><th>RESTOCK AT</th><th>USE BY</th><th>STATUS</th><th/></tr></thead><tbody>{batches.map((batch) => { const status = getBatchStatus(batch, today); return <tr key={batch.batchNumber}>
      <td><button className="table-product" onClick={() => onSelect(batch)}><span className={`product-thumb thumb-${batch.category.toLowerCase()}`}>{batch.name.slice(0, 1)}</span><span><strong>{batch.name}</strong><small>Delivery {batch.batchNumber}</small></span></button></td>
      <td><strong>{batch.quantity}</strong> <span className="table-muted">{batch.unit}</span></td><td>{batch.reorderLevel} <span className="table-muted">{batch.unit}</span></td>
      <td>{new Date(`${batch.expiryDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td><td><span className={`status-pill ${status.tone}`}><i/>{getFriendlyStatusLabel(status)}</span></td>
      <td><button className="row-action" onClick={() => onSelect(batch)} aria-label={`View ${batch.name} details`}>→</button></td></tr> })}</tbody></table></div>
  </section>
}
