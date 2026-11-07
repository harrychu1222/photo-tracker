// Client progress link helpers. The secret lives only in the link; the database keeps its hash.

// 32 random bytes as URL-safe text (43 characters).
export function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let s = ''
  bytes.forEach((b) => (s += String.fromCharCode(b)))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// SHA-256 as lowercase hex: the same value Postgres computes with encode(sha256(...), 'hex').
export async function hashToken(token) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// The token sits after # so it is never sent to any server in a request.
export const linkUrl = (token, origin) => `${origin}/#c=${token}`
export function parseClientToken(hash) {
  const m = /^#c=([A-Za-z0-9_-]{30,200})$/.exec(hash || '')
  return m ? m[1] : null
}

export const EXPIRY_OPTIONS = [
  { value: '3', label: '3 days' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: 'never', label: 'No expiry' }
]
export const expiresAtFor = (value, now = new Date()) => (value === 'never' ? null : new Date(now.getTime() + Number(value) * 86400000).toISOString())

// 'active' | 'expired' | 'off'
export function linkState(link, now = new Date()) {
  if (!link || link.revoked_at) return 'off'
  if (link.expires_at && new Date(link.expires_at) <= now) return 'expired'
  return 'active'
}

// What the client sees of a task: three plain states.
export const CLIENT_STATUS = {
  todo: { label: 'Not started', color: '#8598A6' },
  in_progress: { label: 'In progress', color: '#D98E1F' },
  done: { label: 'Done', color: '#3E8E5D' }
}

export function overallPercent(tasks) {
  if (!tasks.length) return 0
  return Math.round(tasks.reduce((s, t) => s + (t.status === 'done' ? 100 : Number(t.percent) || 0), 0) / tasks.length)
}

// Rooms in order of their earliest task; tasks keep the order the server sent.
export function groupByRoom(tasks) {
  const groups = []
  for (const t of tasks) {
    const name = t.room ? (t.level ? `${t.level} · ${t.room}` : t.room) : 'General'
    let g = groups.find((x) => x.name === name)
    if (!g) groups.push((g = { name, tasks: [] }))
    g.tasks.push(t)
  }
  return groups
}
