/** Sample rows use one unique id per batch/row, even for repeated product names. */
export const sampleInventory = [
  {
    id: 'P001', name: 'Amul Milk', category: 'Dairy', batchNumber: 'MILK-101',
    quantity: 12, unit: 'packets', reorderLevel: 20, expiryDate: '2026-10-17',
    costPrice: 25, sellingPrice: 30,
  },
  {
    id: 'P002', name: 'Amul Milk', category: 'Dairy', batchNumber: 'MILK-102',
    quantity: 28, unit: 'packets', reorderLevel: 20, expiryDate: '2026-10-22',
    costPrice: 25, sellingPrice: 30,
  },
  {
    id: 'P003', name: 'Whole Wheat Bread', category: 'Bakery', batchNumber: 'BRD-204',
    quantity: 8, unit: 'loaves', reorderLevel: 10, expiryDate: '2026-10-15',
    costPrice: 32, sellingPrice: 40,
  },
  {
    id: 'P004', name: 'Greek Yogurt', category: 'Dairy', batchNumber: 'YGT-310',
    quantity: 18, unit: 'cups', reorderLevel: 12, expiryDate: '2026-10-10',
    costPrice: 38, sellingPrice: 50,
  },
  {
    id: 'P005', name: 'Orange Juice', category: 'Beverages', batchNumber: 'JCE-115',
    quantity: 24, unit: 'bottles', reorderLevel: 10, expiryDate: '2026-11-12',
    costPrice: 45, sellingPrice: 60,
  },
]
