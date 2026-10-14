import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createInventoryId,
  getDaysUntilExpiry,
  getExpiryStatus,
  getInventoryAlert,
  getInventoryAlerts,
  getReorderNowItems,
  getSellFirstItems,
  getStockStatus,
} from '../src/utils/inventory.js'

const today = '2026-10-14'

function batch(id, overrides = {}) {
  return {
    id,
    name: id,
    category: 'Test',
    batchNumber: `B-${id}`,
    quantity: 10,
    unit: 'units',
    reorderLevel: 5,
    expiryDate: '2026-11-03',
    costPrice: 1,
    sellingPrice: 2,
    ...overrides,
  }
}

test('expiry and stock edge case matrix', () => {
  const cases = [
    {
      item: batch('milk', { expiryDate: today, quantity: 10, reorderLevel: 5 }),
      expiryStatus: 'Expired', stockStatus: 'Healthy', healthy: false,
    },
    {
      item: batch('bread', { expiryDate: '2026-10-16', quantity: 10, reorderLevel: 5 }),
      expiryStatus: 'Critical', stockStatus: 'Healthy', healthy: false,
    },
    {
      item: batch('biscuits', { expiryDate: '2026-10-20', quantity: 10, reorderLevel: 5 }),
      expiryStatus: 'Warning', stockStatus: 'Healthy', healthy: false,
    },
    {
      item: batch('rice', { expiryDate: '2026-11-03', quantity: 5, reorderLevel: 5 }),
      expiryStatus: 'Healthy', stockStatus: 'Low stock', healthy: false,
    },
    {
      item: batch('juice', { expiryDate: '2026-10-16', quantity: 4, reorderLevel: 5 }),
      expiryStatus: 'Critical', stockStatus: 'Low stock', healthy: false,
    },
    {
      item: batch('expired-low', { expiryDate: '2026-10-13', quantity: 4, reorderLevel: 5 }),
      expiryStatus: 'Expired', stockStatus: 'Low stock', healthy: false,
    },
  ]

  for (const { item, ...expected } of cases) {
    const actual = getInventoryAlert(item, today)
    assert.equal(actual.expiryStatus, expected.expiryStatus, item.id)
    assert.equal(actual.stockStatus, expected.stockStatus, item.id)
    assert.equal(actual.healthy, expected.healthy, item.id)
  }
})

test('Sell First puts expired batches first without recommending their sale', () => {
  const items = [
    batch('warning', { expiryDate: '2026-10-20' }),
    batch('expired', { expiryDate: '2026-10-13' }),
    batch('critical', { expiryDate: '2026-10-15' }),
    batch('today', { expiryDate: today }),
  ]
  const sellFirst = getSellFirstItems(items, today)
  assert.deepEqual(sellFirst.map((item) => item.id), ['expired', 'today', 'critical', 'warning'])
  assert.ok(sellFirst.filter((item) => item.expired).every((item) => item.expiryStatus === 'Expired'))
})

test('Reorder Now includes equality and sorts deterministically', () => {
  const items = [
    batch('equal-b', { quantity: 5, reorderLevel: 5 }),
    batch('above', { quantity: 6, reorderLevel: 5 }),
    batch('short', { quantity: 2, reorderLevel: 5 }),
    batch('equal-a', { quantity: 5, reorderLevel: 5 }),
  ]
  assert.deepEqual(getReorderNowItems(items, today).map((item) => item.id), ['short', 'equal-a', 'equal-b'])
})

test('calendar comparisons, malformed dates, and invalid quantities are safe', () => {
  assert.equal(getDaysUntilExpiry(today, today), 0)
  assert.equal(getDaysUntilExpiry('2026-10-15', today), 1)
  assert.equal(getDaysUntilExpiry('2026-10-13', today), -1)
  assert.equal(getDaysUntilExpiry('2026-02-30', today), null)
  assert.equal(getDaysUntilExpiry('', today), null)
  assert.equal(getExpiryStatus(batch('bad-date', { expiryDate: '2026-02-30' }), today).status, 'Unknown')
  assert.deepEqual(getStockStatus(batch('bad-quantity', { quantity: Number.NaN })), { status: 'Unknown', lowStock: false })
  assert.deepEqual(getStockStatus(batch('string-quantity', { quantity: '5' })), { status: 'Unknown', lowStock: false })
  const alert = getInventoryAlert(batch('unknown', { expiryDate: '', quantity: Number.NaN }), today)
  assert.equal(alert.healthy, false)
  assert.equal(alert.expiryStatus, 'Unknown')
  assert.equal(alert.stockStatus, 'Unknown')
  assert.equal(getInventoryAlerts([batch('one')], today).length, 1)
})

test('generated row IDs avoid supplied existing IDs', () => {
  const existing = ['PRESENT']
  const id = createInventoryId(existing)
  assert.ok(id)
  assert.equal(existing.includes(id), false)
})
