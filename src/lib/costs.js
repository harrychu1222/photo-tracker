// Planned cost helpers. All amounts are in dollars, as entered (GST included).

const cents = (n) => Math.round(n * 100) / 100

// Cost of one material line, or null when no price has been entered.
export function materialCost(material, unitCost) {
  if (unitCost == null || unitCost === '') return null
  return cents(Number(material.quantity || 0) * Number(unitCost))
}

// Planned cost of one task from its material and equipment lines.
// `matPrices` maps material id -> unit cost; `eqPrices` maps equipment id -> cost.
// `unpriced` counts lines that should have a price but don't (own tools are free).
export function taskCost(materials, equipment, matPrices, eqPrices) {
  let mat = 0
  let eq = 0
  let unpriced = 0
  materials.forEach((m) => {
    const c = materialCost(m, matPrices[m.id])
    if (c == null) unpriced += 1
    else mat += c
  })
  equipment.forEach((e) => {
    if (e.kind === 'own') return
    const c = eqPrices[e.id]
    if (c == null) unpriced += 1
    else eq += Number(c)
  })
  return { materials: cents(mat), equipment: cents(eq), total: cents(mat + eq), unpriced }
}

export function sumCosts(list) {
  return list.reduce(
    (acc, c) => ({
      materials: cents(acc.materials + c.materials),
      equipment: cents(acc.equipment + c.equipment),
      total: cents(acc.total + c.total),
      unpriced: acc.unpriced + c.unpriced
    }),
    { materials: 0, equipment: 0, total: 0, unpriced: 0 }
  )
}

// Compare planned cost with the target cost. Returns null when there is no target.
export function againstTarget(planned, target) {
  if (target == null || target === '' || Number(target) <= 0) return null
  const diff = cents(Number(target) - planned)
  return { diff, over: diff < 0, amount: Math.abs(diff) }
}

// Roll material lines up into one shopping list: same name and unit are added together.
export function combineMaterials(materials) {
  const map = new Map()
  materials.forEach((m) => {
    const key = `${m.name.trim().toLowerCase()}|${(m.unit || '').trim().toLowerCase()}`
    const row = map.get(key) || { name: m.name.trim(), unit: (m.unit || '').trim(), quantity: 0, lines: 0 }
    row.quantity = Math.round((row.quantity + Number(m.quantity || 0)) * 1000) / 1000
    row.lines += 1
    map.set(key, row)
  })
  const cmp = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })
  return [...map.values()].sort((a, b) => cmp(a.name, b.name) || cmp(a.unit, b.unit))
}

export function fmtQty(value) {
  return String(Number(Number(value).toFixed(3)))
}
