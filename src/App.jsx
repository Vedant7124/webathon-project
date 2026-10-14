import { useEffect, useMemo, useRef, useState } from 'react'
import ActionQueue from './components/ActionQueue'
import BatchActionModal from './components/BatchActionModal'
import InventoryTable from './components/InventoryTable'
import InventoryManagement from './components/InventoryManagement'
import { InventoryForm } from './components/InventoryComponents'
import { demoInventory, DEMO_TODAY } from './data/demoInventory'
import { loadSharedInventory, saveSharedInventory } from './utils/inventoryApi'
import { estimateExposure, formatCurrency, getAttentionBatches, getBatchStatus } from './utils/inventory'
import './App.css'

const STORAGE_KEY = 'smartstock-demo-batches'
const THEME_KEY = 'smartstock-theme'
function loadBatches() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    const parsed = saved ? JSON.parse(saved) : null
    return Array.isArray(parsed) && parsed.every((batch) => batch.batchNumber && Number.isFinite(batch.quantity)) ? parsed : demoInventory
  } catch { return demoInventory }
}
function loadTheme() {
  try { return window.localStorage.getItem(THEME_KEY) === 'dark' } catch { return false }
}

function Icon({ name, size = 19 }) {
  const shapes = {
    box: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/></>,
    list: <><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    alert: <><path d="M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3l-7.5-13.1a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/></>,
    manage: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></>,
    moon: <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name]}</svg>
}

function App() {
  const [batches, setBatches] = useState(loadBatches)
  const localSnapshotRef = useRef(batches)
  const versionRef = useRef(null)
  const saveQueueRef = useRef(Promise.resolve())
  const unsyncedChangesRef = useRef(false)
  const [syncState, setSyncState] = useState('connecting')
  const [syncMessage, setSyncMessage] = useState('Loading the latest stock')
  const [connectionAttempt, setConnectionAttempt] = useState(0)
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [addingBatch, setAddingBatch] = useState(false)
  const [editingBatch, setEditingBatch] = useState(null)
  const [toast, setToast] = useState('')
  const [activeView, setActiveView] = useState('Today')
  const [darkMode, setDarkMode] = useState(loadTheme)
  const attention = useMemo(() => getAttentionBatches(batches, DEMO_TODAY), [batches])
  const exposure = estimateExposure(batches, DEMO_TODAY)
  const critical = batches.filter((batch) => ['Expired', 'Critical'].includes(getBatchStatus(batch, DEMO_TODAY).label)).length
  const warnings = batches.filter((batch) => getBatchStatus(batch, DEMO_TODAY).label === 'Warning').length
  const lowStock = batches.filter((batch) => {
    const status = getBatchStatus(batch, DEMO_TODAY)
    return status.label === 'Low stock' || status.alsoNeedsRestock
  }).length
  const healthy = batches.filter((batch) => getBatchStatus(batch, DEMO_TODAY).label === 'Healthy').length

  const storeLocalSnapshot = (items) => {
    localSnapshotRef.current = items
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) } catch { /* The shared service remains the source of truth. */ }
  }

  useEffect(() => {
    let cancelled = false
    const connect = async () => {
      setSyncState('connecting')
      setSyncMessage('Loading the latest stock')
      try {
        let shared = await loadSharedInventory()
        const local = localSnapshotRef.current
        const localDiffersFromDemo = JSON.stringify(local) !== JSON.stringify(demoInventory)

        if (unsyncedChangesRef.current) {
          if (shared.version === versionRef.current || (shared.isSeedData && localDiffersFromDemo)) {
            shared = await saveSharedInventory(local, shared.version)
            unsyncedChangesRef.current = false
          } else if (JSON.stringify(shared.batches) !== JSON.stringify(local)) {
            if (!cancelled) {
              setSyncState('conflict')
              setSyncMessage('Stock changed while this device was offline. Reload to use the latest stock.')
            }
            return
          } else {
            unsyncedChangesRef.current = false
          }
        } else if (shared.isSeedData && localDiffersFromDemo) {
          // Carry forward this browser's existing inventory the first time the backend is initialized.
          try {
            shared = await saveSharedInventory(local, shared.version)
          } catch (error) {
            if (!error.latest) throw error
            shared = error.latest
          }
        }

        if (cancelled) return
        versionRef.current = shared.version
        setBatches(shared.batches)
        storeLocalSnapshot(shared.batches)
        setSyncState('saved')
        setSyncMessage('Stock is up to date')
      } catch {
        if (cancelled) return
        setSyncState('offline')
        setSyncMessage('Could not load shared stock. Changes will stay on this device until you reconnect.')
      }
    }
    void connect()
    return () => { cancelled = true }
  }, [connectionAttempt])

  useEffect(() => { storeLocalSnapshot(batches) }, [batches])
  useEffect(() => { try { window.localStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light') } catch { /* Theme still applies for this session. */ } }, [darkMode])
  useEffect(() => { if (!toast) return undefined; const timer = window.setTimeout(() => setToast(''), 3500); return () => window.clearTimeout(timer) }, [toast])

  const persistBatches = (nextBatches) => {
    setBatches(nextBatches)
    storeLocalSnapshot(nextBatches)
    const save = saveQueueRef.current.catch(() => false).then(async () => {
      if (!versionRef.current) {
        unsyncedChangesRef.current = true
        setSyncState('offline')
        setSyncMessage('Could not load shared stock. Changes will stay on this device until you reconnect.')
        return { ok: false, offline: true }
      }

      setSyncState('saving')
      setSyncMessage('Saving your changes')
      try {
        const saved = await saveSharedInventory(nextBatches, versionRef.current)
        versionRef.current = saved.version
        unsyncedChangesRef.current = false
        setSyncState('saved')
        setSyncMessage('Stock is up to date')
        return { ok: true }
      } catch (error) {
        if (error.status === 409 && error.latest) {
          versionRef.current = error.latest.version
          unsyncedChangesRef.current = false
          setBatches(error.latest.batches)
          storeLocalSnapshot(error.latest.batches)
          setSelectedBatch((selected) => selected ? error.latest.batches.find((item) => item.batchNumber === selected.batchNumber) ?? null : null)
          setSyncState('conflict')
          setSyncMessage('Someone else changed the stock. The latest copy is loaded.')
          return { ok: false, conflict: true }
        }
        unsyncedChangesRef.current = true
        setSyncState('offline')
        setSyncMessage('Could not save to shared stock. Your changes are on this device; try again when connected.')
        return { ok: false, offline: true }
      }
    })
    saveQueueRef.current = save
    return save
  }

  const finishMutation = (result, successMessage) => {
    if (result.conflict) {
      setToast('Someone else changed the stock first. The latest copy is loaded; check it and try again.')
      return false
    }
    setToast(result.offline ? `${successMessage} Saved here only. Try again when connected to share it.` : successMessage)
    return true
  }

  const retryConnection = async () => {
    if (syncState === 'conflict') {
      if (unsyncedChangesRef.current && !window.confirm('Remove the changes saved on this device and load the latest shared stock?')) return
      setSyncState('connecting')
      setSyncMessage('Loading the latest stock')
      try {
        const shared = await loadSharedInventory()
        versionRef.current = shared.version
        unsyncedChangesRef.current = false
        setBatches(shared.batches)
        storeLocalSnapshot(shared.batches)
        setSyncState('saved')
        setSyncMessage('Stock is up to date')
        setToast('Latest stock loaded.')
      } catch {
        setSyncState('offline')
        setSyncMessage('Could not load shared stock. Try again when connected.')
      }
      return
    }
    setConnectionAttempt((attempt) => attempt + 1)
  }

  const updateBatch = async (batchNumber, updates) => {
    const batch = batches.find((item) => item.batchNumber === batchNumber)
    if (!batch) return
    const next = batches.map((item) => item.batchNumber === batchNumber ? { ...item, ...updates } : item)
    const result = await persistBatches(next)
    const message = updates.reorderInitiated ? `Order marked as started for ${batch.name}.` : updates.quantity === 0 && updates.resolutionNote === 'Removed from sale' ? `${batch.name} removed from sale.` : `${batch.name} stock updated.`
    if (finishMutation(result, message)) setSelectedBatch(null)
  }

  const addBatch = async (newBatch) => {
    const duplicateBatch = batches.some((batch) => batch.batchNumber.toLowerCase() === newBatch.batchNumber.toLowerCase())
    if (duplicateBatch) {
      setToast(`Delivery number ${newBatch.batchNumber} is already in stock. Enter a different number.`)
      return
    }
    const result = await persistBatches([...batches, newBatch])
    if (finishMutation(result, `${newBatch.name} added to stock.`)) setAddingBatch(false)
  }

  const editBatch = async (updatedBatch) => {
    const originalBatch = editingBatch
    const stockDetailsChanged = ['quantity', 'reorderLevel', 'expiryDate'].some((field) => updatedBatch[field] !== originalBatch[field])
    if (stockDetailsChanged) {
      updatedBatch.resolvedAt = undefined
      updatedBatch.resolutionNote = undefined
      updatedBatch.reorderInitiated = undefined
    }
    const duplicateBatch = batches.some((batch) => batch.batchNumber.toLowerCase() === updatedBatch.batchNumber.toLowerCase() && batch.batchNumber.toLowerCase() !== originalBatch.batchNumber.toLowerCase())
    if (duplicateBatch) {
      setToast(`Delivery number ${updatedBatch.batchNumber} is already in stock. Enter a different number.`)
      return
    }
    const next = batches.map((batch) => batch.batchNumber === originalBatch.batchNumber ? updatedBatch : batch)
    const result = await persistBatches(next)
    if (finishMutation(result, `${updatedBatch.name} details updated.`)) setEditingBatch(null)
  }

  const deleteBatch = async (batch) => {
    if (!window.confirm(`Remove ${batch.name} (delivery ${batch.batchNumber}) from stock? This cannot be undone.`)) return
    const result = await persistBatches(batches.filter((item) => item.batchNumber !== batch.batchNumber))
    finishMutation(result, `${batch.name} removed from stock.`)
  }

  const resetDemoData = async () => {
    if (!window.confirm('Replace all stock with the original sample list? This removes any changes you have made.')) return
    const result = await persistBatches(demoInventory)
    finishMutation(result, 'Sample stock restored.')
  }

  const navItems = [{ label: 'Today', icon: 'list', target: '#today' }, { label: 'Needs attention', icon: 'alert', target: '#actions', count: attention.length }, { label: 'All stock', icon: 'box', target: '#inventory', count: batches.length }]

  return <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
    <aside className="sidebar"><a href="#today" className="brand" onClick={() => setActiveView('Today')}><span className="brand-mark"><Icon name="box" size={19}/></span><span>SmartStock<span className="brand-dot">.</span></span></a>
      <div className="nav-caption">YOUR STORE</div><nav className="main-nav" aria-label="Inventory views">{navItems.map((item) => <a key={item.label} href={item.target} className={`nav-item ${activeView === item.label ? 'active' : ''}`} onClick={() => setActiveView(item.label)}><Icon name={item.icon}/><span>{item.label}</span>{item.count > 0 && <small>{item.count}</small>}</a>)}</nav>
      <div className="sidebar-note"><div className="sidebar-note-icon"><Icon name="clock" size={17}/></div><strong>Made for a quick stock check</strong><p>See what to sell first and what to restock.</p></div>
      <a href="#manage" className={`nav-item sidebar-manage-link ${activeView === 'Manage inventory' ? 'active' : ''}`} onClick={() => setActiveView('Manage inventory')}><Icon name="manage"/><span>Manage stock</span></a>
      <div className="sidebar-user"><span className="user-avatar">VS</span><span><strong>Vedant Sethi</strong><small>Store manager</small></span></div>
    </aside>
    <main className="main-area"><header className="topbar"><span className="crumb"><strong>{activeView === 'Manage inventory' ? 'Manage stock' : 'Today'}</strong></span><div className="topbar-actions"><button className="mobile-view-toggle" type="button" onClick={() => setActiveView((current) => current === 'Manage inventory' ? 'Today' : 'Manage inventory')}>{activeView === 'Manage inventory' ? 'Today' : 'Manage stock'}</button><span className={`sync-indicator ${syncState}`} role="status" aria-label={syncMessage} title={syncMessage}><i/><span>{syncState === 'connecting' ? 'Loading stock' : syncState === 'saving' ? 'Saving' : syncState === 'saved' ? 'Up to date' : syncState === 'conflict' ? 'Stock changed' : 'Offline'}</span>{['offline', 'conflict'].includes(syncState) && <button type="button" onClick={retryConnection}>{syncState === 'conflict' ? 'Reload stock' : 'Try again'}</button>}</span><button className="theme-toggle" type="button" onClick={() => setDarkMode((current) => !current)} aria-label={`Switch to ${darkMode ? 'light' : 'dark'} mode`} aria-pressed={darkMode}><Icon name={darkMode ? 'sun' : 'moon'} size={16}/><span>{darkMode ? 'Light mode' : 'Dark mode'}</span></button><span className="demo-date">TODAY <strong>14 Oct 2026</strong></span></div></header>
      {activeView === 'Manage inventory' ? <InventoryManagement batches={batches} today={DEMO_TODAY} onAdd={() => setAddingBatch(true)} onEdit={setEditingBatch} onDelete={deleteBatch}/> : <div className="page-content" id="today"><section className="greeting"><div><div className="greeting-kicker"><span className="live-dot"/> TODAY’S STOCK</div><h1>Hello, Vedant.</h1><p>See what to sell first, then what needs restocking.</p></div><div className="brief-date">Wednesday <strong>14</strong><span>OCT</span></div></section>

        <section className="attention-banner" aria-label="Today’s stock summary"><div className="attention-lead"><span className="attention-icon"><Icon name="alert" size={20}/></span><div><span className="section-kicker">CHECK THESE ITEMS</span><h2>{attention.length ? `${attention.length} items need attention` : 'Your shelves are in good shape'}</h2><p>{critical} urgent <b>·</b> {warnings} due in 4–7 days <b>·</b> {lowStock} to restock</p></div></div><div className="exposure"><span>Buy cost of stock at risk</span><strong>{formatCurrency(exposure)}</strong><small>Estimate based on quantity × buy price</small></div></section>

        <div className="work-grid"><section className="panel queue-panel" id="actions"><div className="panel-heading queue-heading"><div><div className="section-kicker">START HERE</div><h2>What to handle first</h2><p>Items with the greatest need appear first, based on expiry date and stock level.</p></div><span className="queue-total">{attention.length} TO DO</span></div><ActionQueue batches={attention} today={DEMO_TODAY} onSelect={setSelectedBatch}/></section>

          <aside className="side-column"><section className="panel shelf-panel"><div className="panel-heading compact-heading"><div><div className="section-kicker">QUICK STOCK CHECK</div><h2>At a glance</h2></div><Icon name="box" size={18}/></div><div className="stock-lines"><div className="stock-line urgent"><span><i/>Expired or due in 3 days</span><strong>{critical}</strong></div><div className="stock-line soon"><span><i/>Due in 4–7 days</span><strong>{warnings}</strong></div><div className="stock-line reorder"><span><i/>Restock now</span><strong>{lowStock}</strong></div><div className="stock-line healthy"><span><i/>In good shape</span><strong>{healthy}</strong></div></div><p className="stock-hint">Items close to expiry appear before low-stock reminders.</p></section>
            <section className="loss-note"><span className="loss-icon">₹</span><div><strong>About the cost estimate</strong><p>Uses quantity and buy price. It’s an estimate, not a confirmed loss.</p></div></section>
          </aside></div>

        <InventoryTable batches={batches} today={DEMO_TODAY} onSelect={setSelectedBatch} onAdd={() => setAddingBatch(true)}/>
        <footer className="page-footer"><span>SmartStock · A clearer view of your stock</span><button type="button" onClick={resetDemoData}>Restore sample stock</button></footer>
      </div>}
    </main>
    {selectedBatch && <BatchActionModal batch={selectedBatch} today={DEMO_TODAY} onClose={() => setSelectedBatch(null)} onEdit={() => { setEditingBatch(selectedBatch); setSelectedBatch(null) }} onUpdate={updateBatch}/>}
    {(addingBatch || editingBatch) && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setAddingBatch(false); setEditingBatch(null) } }}><section className="add-batch-dialog" role="dialog" aria-modal="true" aria-label={editingBatch ? `Change ${editingBatch.name} stock details` : 'Add stock'}><button type="button" className="modal-close" onClick={() => { setAddingBatch(false); setEditingBatch(null) }} aria-label="Close">×</button><InventoryForm key={editingBatch?.batchNumber ?? 'new-batch'} initialItem={editingBatch ?? undefined} items={batches} onSave={editingBatch ? editBatch : addBatch} onCancel={() => { setAddingBatch(false); setEditingBatch(null) }}/></section></div>}
    {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
  </div>
}

export default App
