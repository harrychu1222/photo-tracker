// People who have a login: shown by the part of their email before the @.
export const personName = (email) => String(email || '').split('@')[0] || 'Someone'
export const initialsOf = (email) => personName(email).slice(0, 2).toUpperCase()

// A task is given to a person with a login (assigned_user) or to a typed name (assigned_name).
export const nameKey = (n) => `name:${String(n || '').trim().toLowerCase()}`
export const isAssigned = (t) => !!(t.assigned_user || (t.assigned_name || '').trim())
export const assigneeLabel = (t, team) =>
  (t.assigned_name || '').trim() || (t.assigned_user ? personName((team || []).find((m) => m.id === t.assigned_user)?.email) : '')

// Distinct typed names (first spelling wins), from tasks plus any extra names, sorted.
export function knownNames(tasks, extra = []) {
  const seen = new Map()
  for (const n of [...tasks.map((t) => t.assigned_name), ...extra]) {
    const v = String(n || '').trim()
    if (v && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

// who: 'all' | 'me' | 'none' (unassigned) | 'name:<typed name>' | a user id
export function matchWho(task, who, myId) {
  if (!who || who === 'all') return true
  if (who === 'me') return !!myId && task.assigned_user === myId
  if (who === 'none') return !isAssigned(task)
  if (who.startsWith('name:')) return nameKey(task.assigned_name) === who
  return task.assigned_user === who
}
