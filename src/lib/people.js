// People who have a login: shown by the part of their email before the @.
export const personName = (email) => String(email || '').split('@')[0] || 'Someone'
export const initialsOf = (email) => personName(email).slice(0, 2).toUpperCase()

// who: 'all' | 'me' | 'none' (unassigned) | a user id
export function matchWho(task, who, myId) {
  if (!who || who === 'all') return true
  if (who === 'me') return !!myId && task.assigned_user === myId
  if (who === 'none') return !task.assigned_user
  return task.assigned_user === who
}
