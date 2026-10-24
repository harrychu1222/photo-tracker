// Helpers for task dependencies ("waiting on") and for typing many tasks at once.
// A task can wait on several tasks. In the app each task carries `blocked_by_ids`, the
// list of task ids it waits on (WorkContext fills that in).

const idsOf = (t) => t.blocked_by_ids || []

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
// To wait on several tasks, name them: "Tile (after Plumbing, Electrical)". The names must
// match lines above. Bullets ("- ", "* ", "1. ") are ignored, and "| 4" at the end of a
// line sets planned hours.
//
// Each item: { name, parents: [earlier item positions], parent (the first, or null), hours,
// depth, unknownAfter: [names in "(after ...)" that matched no earlier line] }.

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

      // Optional "(after A, B)" naming earlier tasks this one also waits on.
      const afterNames = []
      const a = line.match(/\(\s*after\s+([^)]+)\)\s*$/i)
      if (a) {
        a[1]
          .split(',')
          .map((n) => n.trim())
          .filter(Boolean)
          .forEach((n) => afterNames.push(n))
        line = line.slice(0, a.index)
      }

      const name = line.trim()
      if (!name) return

      while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop()
      const parents = []
      if (stack.length) parents.push(stack[stack.length - 1].index)

      const unknownAfter = []
      afterNames.forEach((n) => {
        let found = -1
        for (let i = items.length - 1; i >= 0; i--) {
          if (items[i].name.toLowerCase() === n.toLowerCase()) {
            found = i
            break
          }
        }
        if (found === -1) unknownAfter.push(n)
        else if (!parents.includes(found)) parents.push(found)
      })

      const index = items.length
      items.push({ name, parents, parent: parents.length ? parents[0] : null, hours, depth, unknownAfter })
      stack.push({ depth, index })
    })

  return items
}

// ---------- Reading dependencies ----------

// For each task: who it waits on, which of those are still unfinished, whether it is held
// up, ready to start, and how many unfinished tasks are waiting on it.
export function dependencyInfo(tasks) {
  const info = {}
  tasks.forEach((t) => {
    info[t.id] = { blockers: [], unfinished: [], waiting: false, ready: false, holdingUp: 0 }
  })
  tasks.forEach((t) => {
    // In list order, so the names always read the same way round.
    const wanted = new Set(idsOf(t))
    const blockers = tasks.filter((b) => wanted.has(b.id) && b.id !== t.id)
    if (!blockers.length) return
    const open = t.status !== 'done'
    const unfinished = blockers.filter((b) => b.status !== 'done')
    const i = info[t.id]
    i.blockers = blockers
    i.unfinished = unfinished
    i.waiting = open && unfinished.length > 0
    i.ready = t.status === 'todo' && unfinished.length === 0
    if (open) unfinished.forEach((b) => (info[b.id].holdingUp += 1))
  })
  return info
}

// The blocker a task is drawn under in the chain view: the one planned to finish last
// (undated ones count as earliest); a tie goes to the one listed later.
function primaryBlocker(task, byId) {
  let best = null
  idsOf(task).forEach((id) => {
    const b = byId[id]
    if (!b || b.id === task.id) return
    if (!best) best = b
    else if ((b.planned_end || '') >= (best.planned_end || '')) best = b
  })
  return best
}

// Lay tasks out so each one sits under the task it waits on: [{ task, depth }].
// `tasks` should already be in the order you want siblings shown. A task with several
// blockers is drawn once, under the one planned to finish last. A task whose blockers are
// not in the list (hidden by a filter, or in another room) starts its own chain.
export function orderByChains(tasks) {
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]))
  const children = {}
  const roots = []
  tasks.forEach((t) => {
    const parent = primaryBlocker(t, byId)
    if (parent) (children[parent.id] ||= []).push(t)
    else roots.push(t)
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

// Ids of every task that (directly or through any chain) waits on `taskId`.
// A task cannot be told to wait on any of these, or the chain would loop.
export function dependentsOf(tasks, taskId) {
  const out = new Set()
  let grew = true
  while (grew) {
    grew = false
    tasks.forEach((t) => {
      if (out.has(t.id)) return
      if (idsOf(t).some((id) => id === taskId || out.has(id))) {
        out.add(t.id)
        grew = true
      }
    })
  }
  return out
}
