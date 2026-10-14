import { useState } from 'react'
import {
  createInventoryId,
  getDaysUntilExpiry,
  getInventoryAlerts,
  getReorderNowItems,
  getSellFirstItems,
} from '../utils/inventory.js'
import './inventory.css'

function formatDate(date) {
  if (!date) return 'No expiry date'
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00Z`))
}

function Quantity({ item }) {
  return <span>{item.quantity} {item.unit}</span>
}

/** InventoryAlerts props: { items: InventoryItem[], today?: Date }. Conditions are independent. */
export function InventoryAlerts({ items = [], today = new Date() }) {
  const alerts = getInventoryAlerts(items, today)
  const groups = [
    { title: 'Expired', action: 'Remove from sale and review', tone: 'danger', items: alerts.filter((item) => item.expired) },
    { title: 'Critical - 1 to 3 days', action: 'Sell first / discount if appropriate', tone: 'critical', items: alerts.filter((item) => item.critical) },
    { title: 'Warning - 4 to 7 days', action: 'Prioritize selling', tone: 'warning', items: alerts.filter((item) => item.warning) },
    { title: 'Low stock', action: 'Reorder', tone: 'info', items: alerts.filter((item) => item.lowStock) },
    { title: 'Needs review', action: 'Check missing or invalid inventory data', tone: 'info', items: alerts.filter((item) => item.expiryStatus === 'Unknown' || item.stockStatus === 'Unknown') },
  ].filter((group) => group.items.length)

  if (!groups.length) {
    return <section className="inventory-card inventory-empty" aria-live="polite">All inventory is healthy. No immediate action needed.</section>
  }

  return (
    <section className="inventory-alerts" aria-label="Inventory alerts" aria-live="polite">
      {groups.map((group) => (
        <article className={`inventory-card inventory-alert inventory-${group.tone}`} key={group.title}>
          <div className="inventory-alert-heading"><h3>{group.title}</h3><span className="inventory-count">{group.items.length}</span></div>
          <p className="inventory-action">{group.action}</p>
          <ul className="inventory-compact-list">
            {group.items.map((item) => (
              <li key={item.id}>
                <span><strong>{item.name}</strong><small>{item.batchNumber}</small></span>
                <span className="inventory-list-meta"><Quantity item={item} />
                  {item.daysUntilExpiry !== null && <small>{item.expired ? `${Math.abs(item.daysUntilExpiry)}d past expiry` : `${item.daysUntilExpiry}d left`}</small>}
                </span>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  )
}

/**
 * SellFirstList props: items: InventoryItem[], today?: Date, onSelect?: (item) => void,
 * onActionComplete?: (item) => void. Expired rows are first and marked for removal;
 * only upcoming batches are shown as sell recommendations.
 */
export function SellFirstList({ items = [], today = new Date(), onSelect, onActionComplete }) {
  const sellFirst = getSellFirstItems(items, today)
  return (
    <section className="inventory-card inventory-list-card">
      <div className="inventory-section-heading"><div><h3>Sell First</h3><p>Prioritize batches nearing expiry</p></div><span className="inventory-count">{sellFirst.length}</span></div>
      {sellFirst.length ? <ul className="inventory-row-list">
        {sellFirst.map((item) => <li key={item.id}>
          <button type="button" className="inventory-product inventory-select" onClick={() => onSelect?.(item)}>
            <strong>{item.name}</strong><small>{item.category} / Batch {item.batchNumber}</small>
          </button>
          <span className="inventory-row-end">
            <span className={`inventory-badge ${item.expired || item.critical ? 'badge-critical' : 'badge-warning'}`}>{item.expired ? 'Expired - remove from sale' : item.critical ? 'Critical' : 'Warning'}</span>
            <strong>{item.expired ? 'Expired' : `${item.daysUntilExpiry} days left`}</strong>
            <small>{formatDate(item.expiryDate)} / <Quantity item={item} /></small>
            {onActionComplete && <button type="button" className="inventory-inline-action" onClick={() => onActionComplete(item)}>{item.expired ? 'Mark reviewed' : 'Mark complete'}</button>}
          </span>
        </li>)}
      </ul> : <p className="inventory-empty-inline">Nothing needs prioritizing right now.</p>}
    </section>
  )
}

/** ReorderNowList props: items: InventoryItem[], today?: Date, onSelect?: (item) => void, onActionComplete?: (item) => void. */
export function ReorderNowList({ items = [], today = new Date(), onSelect, onActionComplete }) {
  const reorder = getReorderNowItems(items, today)
  return (
    <section className="inventory-card inventory-list-card">
      <div className="inventory-section-heading"><div><h3>Reorder Now</h3><p>Stock at or below its reorder level</p></div><span className="inventory-count">{reorder.length}</span></div>
      {reorder.length ? <ul className="inventory-row-list">
        {reorder.map((item) => <li key={item.id}>
          <button type="button" className="inventory-product inventory-select" onClick={() => onSelect?.(item)}>
            <strong>{item.name}</strong><small>{item.category} / Batch {item.batchNumber}</small>
          </button>
          <span className="inventory-row-end"><span className="inventory-badge badge-info">Low stock</span><strong><Quantity item={item} /></strong><small>Reorder at {item.reorderLevel} {item.unit}</small>
            {onActionComplete && <button type="button" className="inventory-inline-action" onClick={() => onActionComplete(item)}>Mark complete</button>}
          </span>
        </li>)}
      </ul> : <p className="inventory-empty-inline">All stock levels are sufficient.</p>}
    </section>
  )
}

const EMPTY_FORM = {
  name: '', category: '', batchNumber: '', quantity: '', unit: '', reorderLevel: '',
  expiryDate: '', costPrice: '', sellingPrice: '',
}

/**
 * InventoryForm props: initialItem?: InventoryItem, items?: InventoryItem[],
 * onSave?: (item: InventoryItem) => void, onSubmit?: (item: InventoryItem) => void (alias),
 * onCancel?: () => void. Edit saves preserve the id; parent replaces the matching row.
 * Create saves use a new id checked against items. Callback receives a complete row.
 */
export function InventoryForm(props) {
  const initialKey = props.initialItem
    ? `${props.initialItem.id}:${JSON.stringify(props.initialItem)}`
    : 'new-inventory-row'
  return <InventoryFormFields key={initialKey} {...props} />
}

function InventoryFormFields({ initialItem, items = [], onSave, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => initialItem ? { ...initialItem } : { ...EMPTY_FORM })
  const [error, setError] = useState('')

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    const save = onSave ?? onSubmit
    if (typeof save !== 'function') {
      setError('A save callback is required.')
      return
    }
    const numericFields = ['quantity', 'reorderLevel', 'costPrice', 'sellingPrice']
    const values = Object.fromEntries(numericFields.map((key) => [key, Number(form[key])]))
    if (numericFields.some((key) => form[key] === '' || !Number.isFinite(values[key]) || values[key] < 0)) {
      setError('Enter valid, non-negative quantities, reorder levels, and prices.')
      return
    }
    if (!form.name.trim() || !form.category.trim() || !form.batchNumber.trim() || !form.unit.trim()) {
      setError('Complete all required fields before saving.')
      return
    }
    if (getDaysUntilExpiry(form.expiryDate) === null) {
      setError('Enter a valid expiry date.')
      return
    }
    setError('')
    save({
      ...form,
      id: initialItem ? initialItem.id : createInventoryId(items.map((item) => item.id)),
      name: form.name.trim(), category: form.category.trim(),
      batchNumber: form.batchNumber.trim(), unit: form.unit.trim(), ...values,
    })
  }

  const fields = [
    ['name', 'Product name', 'text'], ['category', 'Category', 'text'],
    ['batchNumber', 'Batch number', 'text'], ['quantity', 'Quantity', 'number'],
    ['unit', 'Unit', 'text'], ['reorderLevel', 'Reorder level', 'number'],
    ['expiryDate', 'Expiry date', 'date'], ['costPrice', 'Cost price', 'number'],
    ['sellingPrice', 'Selling price', 'number'],
  ]

  return (
    <form className="inventory-card inventory-form" onSubmit={handleSubmit} noValidate>
      <div className="inventory-section-heading"><div><h3>{initialItem ? 'Edit inventory batch' : 'Add inventory batch'}</h3><p>Each entry represents one product batch.</p></div></div>
      <div className="inventory-form-grid">
        {fields.map(([name, label, type]) => <label className="inventory-field" key={name}>
          <span>{label}</span>
          <input name={name} type={type} value={form[name] ?? ''} onChange={updateField} min={type === 'number' ? '0' : undefined} step={type === 'number' ? 'any' : undefined} required />
        </label>)}
      </div>
      {error && <p className="inventory-form-error" role="alert">{error}</p>}
      <div className="inventory-form-actions">
        {onCancel && <button type="button" className="inventory-button inventory-button-secondary" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="inventory-button inventory-button-primary">{initialItem ? 'Save changes' : 'Add batch'}</button>
      </div>
    </form>
  )
}
