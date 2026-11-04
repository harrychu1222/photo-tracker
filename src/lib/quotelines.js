// The scope lines of a quote. Each starts as one of the project's tasks (its name, and the
// materials it uses as the detail) and can then be reworded, reordered, hidden or added to.

// tasks in room order. Returns [{ key, room, text, details, on }].
export function defaultLines(rooms, tasks, materialsByTask) {
  const order = new Map(rooms.map((r, i) => [r.id, i]))
  const roomName = new Map(rooms.map((r) => [r.id, r.name]))
  const sorted = [...tasks].sort((a, b) => (order.get(a.room_id) ?? 999) - (order.get(b.room_id) ?? 999) || (a.sort_order || 0) - (b.sort_order || 0))
  return sorted.map((t) => {
    const names = (materialsByTask[t.id] || []).map((m) => m.name).filter(Boolean)
    return { key: `t:${t.id}`, room: roomName.get(t.room_id) || '', text: t.name, details: names.length ? `Materials: ${names.join(', ')}` : '', on: true }
  })
}

// Saved lines win (wording, order, hidden); tasks added since are appended; deleted tasks drop out.
export function mergeLines(saved, defaults) {
  if (!Array.isArray(saved) || saved.length === 0) return defaults
  const have = new Set(defaults.map((d) => d.key))
  const kept = saved.filter((l) => !String(l.key).startsWith('t:') || have.has(l.key))
  const seen = new Set(kept.map((l) => l.key))
  return [...kept, ...defaults.filter((d) => !seen.has(d.key))]
}

export const autoGstNote = (quote, fmt) => `Includes GST of ${fmt(quote / 11)}`
