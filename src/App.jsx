import { useEffect, useMemo, useState } from 'react'
import ActionQueue from './components/ActionQueue'
import BatchActionModal from './components/BatchActionModal'
import InventoryTable from './components/InventoryTable'
import { demoInventory, DEMO_TODAY } from './data/demoInventory'
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
    moon: <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name]}</svg>
}

function App() {
  const [batches, setBatches] = useState(loadBatches)
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [toast, setToast] = useState('')
  const [activeView, setActiveView] = useState('Today')
  const [darkMode, setDarkMode] = useState(loadTheme)
  const attention = useMemo(() => getAttentionBatches(batches, DEMO_TODAY), [batches])
  const exposure = estimateExposure(batches, DEMO_TODAY)
  const critical = batches.filter((batch) => ['Expired', 'Critical'].includes(getBatchStatus(batch, DEMO_TODAY).label)).length
  const warnings = batches.filter((batch) => getBatchStatus(batch, DEMO_TODAY).label === 'Warning').length
  const lowStock = batches.filter((batch) => getBatchStatus(batch, DEMO_TODAY).label === 'Low stock').length
  const healthy = batches.filter((batch) => getBatchStatus(batch, DEMO_TODAY).label === 'Healthy').length

  useEffect(() => { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(batches)) } catch { /* App remains usable when storage is unavailable. */ } }, [batches])
  useEffect(() => { try { window.localStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light') } catch { /* Theme still applies for this session. */ } }, [darkMode])
  useEffect(() => { if (!toast) return undefined; const timer = window.setTimeout(() => setToast(''), 3500); return () => window.clearTimeout(timer) }, [toast])

  const updateBatch = (batchNumber, updates) => {
    const batch = batches.find((item) => item.batchNumber === batchNumber)
    setBatches((current) => current.map((item) => item.batchNumber === batchNumber ? { ...item, ...updates } : item))
    const message = updates.reorderInitiated ? `Reorder initiated for ${batch.name}.` : updates.quantity === 0 && updates.resolutionNote === 'Removed from sale' ? `${batch.name} removed from sale.` : `${batch.name} stock updated. The action is recorded.`
    setToast(message)
    setSelectedBatch(null)
  }

  const navItems = [{ label: 'Today', icon: 'list', target: '#today' }, { label: 'Expiry & reorder', icon: 'alert', target: '#actions', count: attention.length }, { label: 'All batches', icon: 'box', target: '#inventory', count: batches.length }]

  return <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
    <aside className="sidebar"><a href="#today" className="brand"><span className="brand-mark"><Icon name="box" size={19}/></span><span>SmartStock<span className="brand-dot">.</span></span></a>
      <div className="store-switch"><span className="store-avatar">G</span><span className="store-text"><strong>Green Basket</strong><small>Neighborhood store</small></span><span className="store-chevron">⌄</span></div>
      <div className="nav-caption">YOUR STORE</div><nav className="main-nav" aria-label="Inventory views">{navItems.map((item) => <a key={item.label} href={item.target} className={`nav-item ${activeView === item.label ? 'active' : ''}`} onClick={() => setActiveView(item.label)}><Icon name={item.icon}/><span>{item.label}</span>{item.count > 0 && <small>{item.count}</small>}</a>)}</nav>
      <div className="sidebar-note"><div className="sidebar-note-icon"><Icon name="clock" size={17}/></div><strong>Built for the daily shop run</strong><p>Spot what needs action. Keep every batch accounted for.</p></div>
      <div className="sidebar-user"><span className="user-avatar">AK</span><span><strong>Arjun Kumar</strong><small>Store manager</small></span><span className="user-dots">···</span></div>
    </aside>
    <main className="main-area"><header className="topbar"><span className="crumb">Green Basket <b>/</b> <strong>Daily brief</strong></span><div className="topbar-actions"><button className="theme-toggle" type="button" onClick={() => setDarkMode((current) => !current)} aria-label={`Switch to ${darkMode ? 'light' : 'dark'} mode`} aria-pressed={darkMode}><Icon name={darkMode ? 'sun' : 'moon'} size={16}/><span>{darkMode ? 'Light mode' : 'Dark mode'}</span></button><span className="demo-date">DEMO DATE <strong>14 Oct 2026</strong></span></div></header>
      <div className="page-content" id="today"><section className="greeting"><div><div className="greeting-kicker"><span className="live-dot"/> YOUR DAILY STOCK BRIEF</div><h1>Good morning, Arjun.</h1><p>Here’s what to handle first to protect today’s stock.</p></div><div className="brief-date">Tuesday <strong>14</strong><span>OCT</span></div></section>

        <section className="attention-banner" aria-label="Today's priority summary"><div className="attention-lead"><span className="attention-icon"><Icon name="alert" size={20}/></span><div><span className="section-kicker">TODAY’S ATTENTION</span><h2>{attention.length ? `${attention.length} actions to keep stock moving` : 'Your shelves are in good shape'}</h2><p>{critical} critical <b>·</b> {warnings} expiring soon <b>·</b> {lowStock} reorder</p></div></div><div className="exposure"><span>Estimated cost exposure</span><strong>{formatCurrency(exposure)}</strong><small>Current at-risk batches × cost price</small></div></section>

        <div className="work-grid"><section className="panel queue-panel" id="actions"><div className="panel-heading queue-heading"><div><div className="section-kicker">YOUR NEXT BEST ACTIONS</div><h2>Handle these first</h2><p>Ranked by expiry urgency and stock pressure.</p></div><span className="queue-total">{attention.length} OPEN</span></div><ActionQueue batches={attention} today={DEMO_TODAY} onSelect={setSelectedBatch}/><div className="queue-legend"><span><i className="score-dot"/> Priority score</span><span>Expiry urgency + reorder pressure</span></div></section>

          <aside className="side-column"><section className="panel shelf-panel"><div className="panel-heading compact-heading"><div><div className="section-kicker">SHELF CHECK</div><h2>Stock at a glance</h2></div><Icon name="box" size={18}/></div><div className="stock-lines"><div className="stock-line urgent"><span><i/>Critical / expired</span><strong>{critical}</strong></div><div className="stock-line soon"><span><i/>Expiring in 4–7 days</span><strong>{warnings}</strong></div><div className="stock-line reorder"><span><i/>Below reorder level</span><strong>{lowStock}</strong></div><div className="stock-line healthy"><span><i/>Healthy batches</span><strong>{healthy}</strong></div></div><p className="stock-hint">Expiry takes priority over reorder status for the same batch.</p></section>
            <section className="loss-note"><span className="loss-icon">₹</span><div><strong>Make the cost visible</strong><p>Exposure is the purchase cost of stock at risk. It’s a planning estimate, not money already lost.</p></div></section>
          </aside></div>

        <InventoryTable batches={batches} today={DEMO_TODAY} onSelect={setSelectedBatch}/>
        <footer className="page-footer"><span>SmartStock · Batch-level stock clarity</span><button onClick={() => { try { window.localStorage.removeItem(STORAGE_KEY) } catch { /* Reset still works for this session. */ } setBatches(demoInventory); setToast('Demo inventory reset to its starting state.') }}>Reset demo data</button></footer>
      </div>
    </main>
    {selectedBatch && <BatchActionModal batch={selectedBatch} today={DEMO_TODAY} onClose={() => setSelectedBatch(null)} onUpdate={updateBatch}/>}
    {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
  </div>
}

export default App
