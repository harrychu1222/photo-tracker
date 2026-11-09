// Search across everything a person can already see. All words typed must appear (any order,
// any case). Returns groups of results, each knowing which project and tab to open.
const norm = (v) => (Array.isArray(v) ? v.join(' ') : String(v ?? '')).toLowerCase()

export const words = (q) => String(q || '').toLowerCase().split(/\s+/).filter(Boolean)

const matches = (ws, ...fields) => {
  const hay = fields.map(norm).join(' \u0001 ')
  return ws.every((w) => hay.includes(w))
}

// A short piece of text around the first match, so the result shows why it matched.
export function snippet(text, ws, max = 90) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  const low = t.toLowerCase()
  const at = Math.min(...ws.map((w) => low.indexOf(w)).filter((i) => i >= 0), Infinity)
  if (!isFinite(at) || t.length <= max) return t.slice(0, max)
  const start = Math.max(0, at - 25)
  return (start > 0 ? '…' : '') + t.slice(start, start + max) + (start + max < t.length ? '…' : '')
}

// data: { projects, tasks, rooms, photos, diary (array), issues, defects, materials }
export function searchAll(query, data, limit = 8) {
  const ws = words(query)
  if (!ws.length) return []
  const proj = Object.fromEntries((data.projects || []).map((p) => [p.id, p]))
  const roomName = Object.fromEntries((data.rooms || []).map((r) => [r.id, r.name]))
  const taskProject = Object.fromEntries((data.tasks || []).map((t) => [t.id, t.project_id]))
  const pname = (id) => proj[id]?.name || ''
  const groups = []
  const add = (type, label, items) => {
    if (items.length) groups.push({ type, label, total: items.length, items: items.slice(0, limit) })
  }

  add('project', 'Projects', (data.projects || [])
    .filter((p) => matches(ws, p.name, p.client, p.site_address))
    .map((p) => ({ id: p.id, projectId: p.id, tab: null, title: p.name, sub: [p.client, p.site_address].filter(Boolean).join(' · ') })))

  add('task', 'Tasks', (data.tasks || [])
    .filter((t) => proj[t.project_id] && matches(ws, t.name, t.notes, roomName[t.room_id], pname(t.project_id)))
    .map((t) => ({ id: t.id, projectId: t.project_id, tab: 'plan', title: t.name, sub: `${pname(t.project_id)}${roomName[t.room_id] ? ' · ' + roomName[t.room_id] : ''}`, snip: t.notes && matches(ws, t.notes) && !matches(ws, t.name) ? snippet(t.notes, ws) : '' })))

  add('photo', 'Photos', (data.photos || [])
    .filter((p) => p.project_id && proj[p.project_id] && matches(ws, p.notes, p.location, p.room, p.category, p.tags, p.status, pname(p.project_id)))
    .map((p) => ({ id: p.id, projectId: p.project_id, tab: 'photos', title: [p.category, p.room || p.location].filter(Boolean).join(' · ') || 'Photo', sub: pname(p.project_id), snip: snippet(p.notes || (p.tags || []).join(', '), ws), thumb: p.url || null })))

  add('diary', 'Site diary', (data.diary || [])
    .filter((e) => proj[e.project_id] && matches(ws, e.work_done, e.on_site, e.weather, e.issues, e.entry_date))
    .map((e) => ({ id: e.id, projectId: e.project_id, tab: 'site', title: `Diary ${e.entry_date}`, sub: pname(e.project_id), snip: snippet(e.work_done || e.issues || e.on_site, ws) })))

  add('issue', 'Issues', (data.issues || [])
    .filter((i) => proj[i.project_id] && matches(ws, i.text, i.resolution_note))
    .map((i) => ({ id: i.id, projectId: i.project_id, tab: 'site', title: i.text, sub: pname(i.project_id) })))

  add('defect', 'Defects', (data.defects || [])
    .filter((d) => proj[d.project_id] && matches(ws, d.title, d.notes))
    .map((d) => ({ id: d.id, projectId: d.project_id, tab: 'defects', title: d.title, sub: pname(d.project_id), snip: d.notes && !matches(ws, d.title) ? snippet(d.notes, ws) : '' })))

  add('material', 'Materials', (data.materials || [])
    .map((m) => ({ m, projectId: m.project_id || taskProject[m.task_id] }))
    .filter(({ m, projectId }) => proj[projectId] && matches(ws, m.name, m.supplier))
    .map(({ m, projectId }) => ({ id: m.id, projectId, tab: 'materials', title: m.name, sub: pname(projectId) })))

  return groups
}
