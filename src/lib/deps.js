// Helpers for task dependencies ("waiting on") and for typing many tasks at once.

// ---------- Bulk add: turn typed text into a list of tasks ----------
//
// One task per line. Make a line wait on the one above it by starting it with ">"
// (or by indenting it with a tab or two spaces). ">>" goes one level deeper, and so on.
// A line waits on the nearest earlier line that is less indented than it, so
//
//   Strip out
//   > Plumbing
//   >> Tile
//   > Electrical
//
// means Plumbing and Electrical both wait on Strip out, and Tile waits on Plumbing.
// Bullets ("- ", "* ", "1. ") are ignored, and "| 4" at the end of a line sets planned hours.

export function parseBulkTasks(text) {
  const items = []
  const stack = [] // { depth, index }

  String(text || '')
    .split(/\r?\n/)
    .forEach((raw) => {
      if (!raw.trim()) return

      let line = raw
      let depth = 0

      // Indentation: a tab or two spaces is one level.
      const indent = line.match(/^[ \t]*/)[0]
      depth += (indent.match(/\t/g) || []).length + Math.floor(indent.replace(/\t/g, '').length / 2)
      line = line.slice(indent.length)

      // Leading ">" markers, each one level.
      const arrows = line.match(/^(?:>\s*)+/)
      if (arrows) {
        depth += (arrows[0].match(/>/g) || []).length
        line = line.slice(arrows[0].length)
      }

      line = line.replace(/^(?:[-*•]|\d+[.)])\s+/, '')

      // Optional "| 4" or "| 4h" planned hours at the end.
      let hours = null
      const h = line.match(/\|\s*(\d+(?:\.\d+)?)\s*h?\s*$/i)
      if (h) {
        hours = Number(h[1])
        line = line.slice(0, h.index)
      }

      const name = line.trim()
      if (!name) return

      while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop()
      const parent = stack.length ? stack[stack.length - 1].index : null
      const index = items.length
      items.push({ name, parent, hours, depth })
      stack.push({ depth, index })
    })

  return items
}

// ---------- Reading dependencies ----------

// For each task: who it waits on, whether it is still held up, and how many unfinished
// tasks are waiting on it.
export function dependencyInfo(tasks) {
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]))
  const info = {}
  tasks.forEach((t) => {
    info[t.id] = { blocker: null, waiting: false, ready: false, holdingUp: 0 }
  })
  tasks.forEach((t) => {
    const blocker = t.blocked_by ? byId[t.blocked_by] : null
    if (!blocker) return
    const open = t.status !== 'done'
    info[t.id].blocker = blocker
    info[t.id].waiting = open && blocker.status !== 'done'
    info[t.id].ready = t.status === 'todo' && blocker.status === 'done'
    if (open && blocker.status !== 'done') info[blocker.id].holdingUp += 1
  })
  return info
}

// Lay tasks out so each one sits under the task it waits on: [{ task, depth }].
// `tasks` should already be in the order you want siblings shown. A task whose blocker is
// not in the list (hidden by a filter, or in another room) starts its own chain.
export function orderByChains(tasks) {
  const ids = new Set(tasks.map((t) => t.id))
  const children = {}
  const roots = []
  tasks.forEach((t) => {
    if (t.blocked_by && ids.has(t.blocked_by) && t.blocked_by !== t.id) {
      ;(children[t.blocked_by] ||= []).push(t)
    } else {
      roots.push(t)
    }
  })

  const out = []
  const seen = new Set()
  function walk(task, depth) {
    if (seen.has(task.id)) return
    seen.add(task.id)
    out.push({ task, depth })
    ;(children[task.id] || []).forEach((c) => walk(c, depth + 1))
  }
  roots.forEach((t) => walk(t, 0))
  // Anything left over can only be part of a loop; show it rather than hide it.
  tasks.forEach((t) => walk(t, 0))
  return out
}

// Ids of every task that (directly or through a chain) waits on `taskId`.
// A task cannot be told to wait on any of these, or the chain would loop.
export function dependentsOf(tasks, taskId) {
  const out = new Set()
  let grew = true
  while (grew) {
    grew = false
    tasks.forEach((t) => {
      if (t.blocked_by && (t.blocked_by === taskId || out.has(t.blocked_by)) && !out.has(t.id)) {
        out.add(t.id)
        grew = true
      }
    })
  }
  return out
}
