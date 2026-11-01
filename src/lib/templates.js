// Default task templates for general residential renovation. Each task: name, hours (labour),
// after = indexes of earlier tasks it waits on, materials [name, qty, unit], equipment [names].
// Quantities are starting points; measure the room and fix them on the Materials tab.
const T = (name, hours, after, materials = [], equipment = []) => ({ name, hours, after, materials, equipment })

export const DEFAULT_TEMPLATES = {
  Kitchen: [
    T('Strip out old kitchen', 8, [], [['Skip bin', 1, 'each']], ['Crowbar', 'Dust sheets']),
    T('Plumbing and electrical rough-in', 12, [0], [], ['Pipe tools']),
    T('Plaster and patch walls', 16, [1], [['Plasterboard', 6, 'sheets'], ['Plaster', 2, 'bags']], ['Plastering tools']),
    T('Paint walls and ceiling', 12, [2], [['Paint', 2, 'tins'], ['Undercoat', 1, 'tin']], ['Rollers and brushes']),
    T('Install cabinets', 16, [3], [['Cabinets', 1, 'set']], ['Drill', 'Level']),
    T('Install benchtop', 8, [4], [['Benchtop', 1, 'each']], ['Jigsaw']),
    T('Splashback tiling', 12, [5], [['Splashback tiles', 4, 'm2'], ['Tile adhesive', 1, 'bag'], ['Grout', 1, 'bag']], ['Tile cutter', 'Notched trowel']),
    T('Fit taps, sink and appliances', 6, [6], [['Tap set', 1, 'each'], ['Sink', 1, 'each']]),
    T('Final clean and touch-up', 4, [7])
  ],
  Bathroom: [
    T('Strip out old bathroom', 8, [], [['Skip bin', 1, 'each']], ['Crowbar', 'Dust sheets']),
    T('Plumbing rough-in', 8, [0], [], ['Pipe tools']),
    T('Wall and ceiling lining', 12, [1], [['Villaboard', 8, 'sheets'], ['Screws', 1, 'box']], ['Drill']),
    T('Waterproofing', 8, [2], [['Waterproofing membrane', 1, 'tin'], ['Bond tape', 1, 'roll']], ['Roller']),
    T('Floor and wall tiling', 24, [3], [['Floor tiles', 6, 'm2'], ['Wall tiles', 20, 'm2'], ['Tile adhesive', 3, 'bags'], ['Grout', 2, 'bags']], ['Tile cutter', 'Notched trowel']),
    T('Paint ceiling', 4, [4], [['Ceiling paint', 1, 'tin']], ['Roller']),
    T('Install vanity, toilet and shower', 12, [5], [['Vanity', 1, 'each'], ['Toilet suite', 1, 'each'], ['Shower screen', 1, 'each']]),
    T('Fit taps, mirror and accessories', 4, [6], [['Tap set', 1, 'each'], ['Mirror', 1, 'each']]),
    T('Silicone and final clean', 3, [7], [['Silicone', 2, 'tubes']])
  ],
  Toilet: [
    T('Strip out old toilet', 3, [], [], ['Crowbar']),
    T('Plumbing and lining', 6, [0], [['Villaboard', 3, 'sheets']]),
    T('Waterproof and tile floor', 10, [1], [['Waterproofing membrane', 1, 'tin'], ['Floor tiles', 3, 'm2'], ['Tile adhesive', 1, 'bag']], ['Tile cutter']),
    T('Paint', 3, [2], [['Paint', 1, 'tin']]),
    T('Install toilet and accessories', 3, [3], [['Toilet suite', 1, 'each']])
  ],
  Laundry: [
    T('Strip out old laundry', 5, [], [['Skip bin', 1, 'each']], ['Crowbar']),
    T('Plumbing and electrical', 6, [0], [], ['Pipe tools']),
    T('Wall lining and paint', 10, [1], [['Plasterboard', 4, 'sheets'], ['Paint', 1, 'tin']]),
    T('Floor tiling', 8, [2], [['Floor tiles', 5, 'm2'], ['Tile adhesive', 1, 'bag'], ['Grout', 1, 'bag']], ['Tile cutter']),
    T('Install cabinets and trough', 8, [3], [['Laundry cabinet', 1, 'each'], ['Trough', 1, 'each']]),
    T('Final clean', 2, [4])
  ],
  Flooring: [
    T('Remove old flooring', 6, [], [['Skip bin', 1, 'each']], ['Floor scraper']),
    T('Prepare and level subfloor', 6, [0], [['Levelling compound', 2, 'bags']], ['Straight edge']),
    T('Lay new flooring', 12, [1], [['Flooring', 20, 'm2'], ['Underlay', 20, 'm2']], ['Saw', 'Spacers']),
    T('Fit skirting and trims', 5, [2], [['Skirting', 15, 'lm'], ['Liquid nails', 1, 'tube']], ['Nail gun']),
    T('Final clean', 2, [3])
  ]
}

// Which template a room type starts with (Ensuite uses the Bathroom list).
const ALIAS = { Ensuite: 'Bathroom' }
export const templateKeyFor = (type) => {
  const k = ALIAS[type] || type
  return DEFAULT_TEMPLATES[k] ? k : null
}
// Rooms that can also take the Flooring template (off by default).
export const FLOORING_ROOMS = ['Bedroom', 'Living', 'Dining', 'Hallway', 'Study']

// Keep the ticked tasks; a task that waited on an unticked one now waits on what that one waited on.
export function compactItems(items) {
  const newIndex = {}
  const kept = []
  items.forEach((it, i) => {
    if (it.on !== false) { newIndex[i] = kept.length; kept.push(i) }
  })
  const resolve = (i, seen = new Set()) => {
    if (newIndex[i] != null) return [newIndex[i]]
    if (seen.has(i)) return []
    seen.add(i)
    return (items[i].after || []).flatMap((p) => resolve(p, seen))
  }
  return kept.map((i) => {
    const it = items[i]
    const withKit = it.kit !== false
    return {
      name: it.name,
      hours: it.hours === '' || it.hours == null ? null : Number(it.hours),
      after: [...new Set((it.after || []).flatMap((p) => resolve(p)))],
      materials: withKit ? it.materials || [] : [],
      equipment: withKit ? it.equipment || [] : []
    }
  })
}

export const startItems = (list) => (list || []).map((t) => ({ ...t, on: true, kit: true }))

// ---- Scheduling: working days only (Mon-Fri), 8 hours a day, each task starts the working day
// after the last task it waits on ends. Returns [{ start, end }] as yyyy-mm-dd, same order as items.
const iso = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
const parse = (s) => new Date(`${s}T00:00:00Z`)
const isWeekend = (d) => d.getUTCDay() === 0 || d.getUTCDay() === 6
function nextWorkday(d, step = 1) {
  const x = new Date(d)
  if (step) x.setUTCDate(x.getUTCDate() + 1)
  while (isWeekend(x)) x.setUTCDate(x.getUTCDate() + 1)
  return x
}
export function scheduleItems(items, startISO) {
  const out = []
  items.forEach((it, i) => {
    let start = nextWorkday(parse(startISO), 0)
    ;(it.after || []).forEach((p) => {
      const s = nextWorkday(parse(out[p].end))
      if (s > start) start = s
    })
    const days = Math.max(1, Math.ceil((Number(it.hours) || 0) / 8))
    let end = start
    for (let k = 1; k < days; k++) end = nextWorkday(end)
    out.push({ start: iso(start), end: iso(end) })
  })
  return out
}
export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
