import { useMemo, useState } from 'react'
import { getBatchStatus } from '../utils/inventory'

export default function InventoryManagement({ batches, today, onAdd, onEdit, onDelete }) {
  const [query, setQuery] = useState('')
  const visibleBatches = useMemo(() => batches.filter((batch) => `${batch.name} ${batch.category} ${batch.id} ${batch.batchNumber}`.toLowerCase().includes(query.trim().toLowerCase())), [batches, query])

  return <div className="page-content management-page" id="manage">
    <section className="management-heading"><div><div className="greeting-kicker">INVENTORY SETTINGS</div><h1>Manage inventory</h1><p>Add products, update batch details, or remove entries from your store inventory.</p></div><button className="primary-button" type="button" onClick={onAdd}>+ Add batch</button></section>
    <section className="panel management-panel"><div className="management-toolbar"><label className="management-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search product, category, or batch…" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search inventory"/></label><span className="management-count">{visibleBatches.length} of {batches.length} batches</span></div>
      {visibleBatches.length ? <div className="table-wrap"><table className="management-table"><thead><tr><th>PRODUCT / BATCH</th><th>QUANTITY</th><th>REORDER LEVEL</th><th>EXPIRY</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{visibleBatches.map((batch) => { const status = getBatchStatus(batch, today); return <tr key={batch.batchNumber}>
        <td><span className="management-product"><strong>{batch.name}</strong><small>{batch.category} · {batch.id} · {batch.batchNumber}</small></span></td>
        <td>{batch.quantity} {batch.unit}</td><td>{batch.reorderLevel} {batch.unit}</td><td>{new Date(`${batch.expiryDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
        <td><span className={`status-pill ${status.tone}`}><i/>{status.label}</span></td><td><div className="management-actions"><button type="button" className="secondary-button" onClick={() => onEdit(batch)}>Edit</button><button type="button" className="delete-button" onClick={() => onDelete(batch)}>Delete</button></div></td>
      </tr> })}</tbody></table></div> : <div className="management-empty"><strong>{batches.length ? 'No batches match that search.' : 'No inventory yet.'}</strong><span>{batches.length ? 'Try a different product name or batch number.' : 'Add your first batch to start tracking stock.'}</span>{!batches.length && <button className="primary-button" type="button" onClick={onAdd}>Add batch</button>}</div>}
    </section>
    <p className="management-footnote">Changes made here update your daily brief, priority queue, stock counts, and expiry exposure.</p>
  </div>
}
