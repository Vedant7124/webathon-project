import { useMemo, useState } from 'react'
import { getBatchStatus } from '../utils/inventory'
import { getFriendlyStatusLabel } from '../utils/statusLabels'

export default function InventoryManagement({ batches, today, onAdd, onEdit, onDelete }) {
  const [query, setQuery] = useState('')
  const visibleBatches = useMemo(() => batches.filter((batch) => `${batch.name} ${batch.category} ${batch.batchNumber}`.toLowerCase().includes(query.trim().toLowerCase())), [batches, query])

  return <div className="page-content management-page" id="manage">
    <section className="management-heading"><div><div className="greeting-kicker">YOUR STOCK</div><h1>Manage stock</h1><p>Add items, update quantities, or remove stock. Each batch is one delivery of a product.</p></div><button className="primary-button" type="button" onClick={onAdd}>+ Add stock</button></section>
    <section className="panel management-panel"><div className="management-toolbar"><label className="management-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search by item or delivery number…" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search stock"/></label><span className="management-count">Showing {visibleBatches.length} of {batches.length} items</span></div>
      {visibleBatches.length ? <div className="table-wrap"><table className="management-table"><thead><tr><th>ITEM</th><th>IN STOCK</th><th>RESTOCK AT</th><th>USE BY</th><th>STATUS</th><th>CHANGE</th></tr></thead><tbody>{visibleBatches.map((batch) => { const status = getBatchStatus(batch, today); return <tr key={batch.batchNumber}>
        <td><span className="management-product"><strong>{batch.name}</strong><small>{batch.category} · Delivery {batch.batchNumber}</small></span></td>
        <td>{batch.quantity} {batch.unit}</td><td>{batch.reorderLevel} {batch.unit}</td><td>{new Date(`${batch.expiryDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
        <td><span className={`status-pill ${status.tone}`}><i/>{getFriendlyStatusLabel(status)}</span></td><td><div className="management-actions"><button type="button" className="secondary-button" onClick={() => onEdit(batch)}>Change</button><button type="button" className="delete-button" onClick={() => onDelete(batch)}>Remove</button></div></td>
      </tr> })}</tbody></table></div> : <div className="management-empty"><strong>{batches.length ? 'No items match that search.' : 'No stock has been added yet.'}</strong><span>{batches.length ? 'Try another item name or delivery number.' : 'Add your first item to start tracking stock.'}</span>{!batches.length && <button className="primary-button" type="button" onClick={onAdd}>Add stock</button>}</div>}
    </section>
    <p className="management-footnote">Changes here also update today’s reminders and stock counts.</p>
  </div>
}
