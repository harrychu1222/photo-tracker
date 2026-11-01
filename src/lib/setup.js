// New-project questionnaire: which levels the job covers and which rooms are on each.
export const LEVELS = [
  { id: 'basement', label: 'Basement', kind: 'indoor' },
  { id: 'ground', label: 'Ground', kind: 'indoor' },
  { id: 'level1', label: 'Level 1', kind: 'indoor' },
  { id: 'level2', label: 'Level 2', kind: 'indoor' },
  { id: 'roof', label: 'Roof', kind: 'roof' },
  { id: 'exterior', label: 'Exterior', kind: 'exterior' }
]

export const ROOM_CHOICES = {
  indoor: ['Kitchen', 'Bathroom', 'Ensuite', 'Toilet', 'Laundry', 'Bedroom', 'Living', 'Dining', 'Hallway', 'Study', 'Garage'],
  roof: ['Roof'],
  exterior: ['Facade', 'Deck', 'Fencing', 'Garden', 'Driveway']
}

export const levelById = (id) => LEVELS.find((l) => l.id === id)

// plan: { [levelId]: { [roomName]: count } }  ->  [{ name, level, type }] in level order.
// Two or more of a room become "Bedroom 1", "Bedroom 2". When rooms sit on more than one indoor
// level, every indoor room gets its level in front ("Ground Bathroom 1", "Level 1 Bathroom 1").
// `type` is the room as chosen ("Bathroom"), used to find task templates.
export function buildRooms(plan) {
  const list = []
  LEVELS.forEach((lv) => {
    Object.entries(plan[lv.id] || {}).forEach(([name, count]) => {
      const n = Math.max(0, Math.floor(Number(count) || 0))
      for (let i = 1; i <= n; i++) list.push({ base: n > 1 ? `${name} ${i}` : name, level: lv.label, kind: lv.kind, type: name })
    })
  })
  const multi = new Set(list.filter((r) => r.kind === 'indoor').map((r) => r.level)).size > 1
  const seen = {}
  list.forEach((r) => {
    const k = r.base.toLowerCase()
    seen[k] = (seen[k] || 0) + 1
  })
  const used = new Set()
  return list.map((r) => {
    const prefix = (multi && r.kind === 'indoor') || seen[r.base.toLowerCase()] > 1
    let name = prefix ? `${r.level} ${r.base}` : r.base
    let k = 2
    const root = name
    while (used.has(name.toLowerCase())) name = `${root} ${k++}`
    used.add(name.toLowerCase())
    return { name, level: r.level, type: r.type }
  })
}
