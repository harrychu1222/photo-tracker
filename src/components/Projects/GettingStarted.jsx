import { useState } from 'react'
import { useWork } from '../../context/WorkContext'

const KEY = 'sitelog.gettingStarted.hidden'
const read = () => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

// First-run checklist for a manager: create a job, take a photo, invite the crew.
// Ticks itself as each is done and goes away when all are done (or "Hide" is tapped).
export default function GettingStarted({ projectCount, photoCount, onNew, onAddPhoto, onTeam }) {
  const { team } = useWork()
  const [hidden, setHidden] = useState(read)
  const steps = [
    { id: 'job', done: projectCount > 0, title: 'Create your first job', hint: 'Pick the rooms and a template and the tasks and dates fill themselves in.', action: 'Start', run: onNew },
    { id: 'photo', done: photoCount > 0, title: 'Take your first photo', hint: 'Photos are sorted by job and room, so you can find them later.', action: 'Add photo', run: onAddPhoto, needs: projectCount > 0 },
    { id: 'crew', done: (team || []).length > 1, title: 'Invite your crew', hint: 'Make a code on the Team page and send it. They see only their own tasks.', action: 'Open Team', run: onTeam }
  ]
  if (hidden || steps.every((s) => s.done)) return null
  const doneCount = steps.filter((s) => s.done).length
  const next = steps.find((s) => !s.done)

  function hide() {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* private mode: it just comes back next time */
    }
    setHidden(true)
  }

  return (
    <section aria-label="Getting started" className="mb-5 rounded-2xl border border-signal-500/40 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-ink-900">Get started</h3>
          <p className="text-sm text-ink-600">{doneCount} of {steps.length} done</p>
        </div>
        <button onClick={hide} className="min-h-[44px] px-2 text-sm font-medium text-ink-600 underline">Hide</button>
      </div>
      <ol className="mt-3 space-y-2">
        {steps.map((s) => (
          <li key={s.id} className="flex items-start gap-3 rounded-xl border border-ink-100 p-3">
            <span aria-hidden className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full border text-xs font-bold ${s.done ? 'border-status-done bg-status-done text-white' : 'border-ink-200 text-ink-400'}`}>
              {s.done ? '✓' : ''}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold ${s.done ? 'text-ink-400 line-through' : 'text-ink-900'}`}>{s.title}</p>
              {!s.done && <p className="text-xs text-ink-600">{s.hint}</p>}
            </div>
            {!s.done && s.run && s.needs !== false && (
              <button
                onClick={s.run}
                className={`min-h-[44px] flex-none rounded-lg px-4 text-sm font-semibold ${s === next ? 'bg-signal-500 text-ink-950' : 'border border-ink-200 bg-white text-ink-900'}`}
              >
                {s.action}
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
