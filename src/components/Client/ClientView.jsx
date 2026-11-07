import { useEffect, useState } from 'react'
import { clientPhotoUrl, fetchClientView } from '../../lib/clientApi'
import { CLIENT_STATUS, groupByRoom, overallPercent } from '../../lib/clientshare'
import { fmtDate, fmtDateRange } from '../../lib/format'

function setMeta(name, content) {
  let m = document.querySelector(`meta[name="${name}"]`)
  if (!m) {
    m = document.createElement('meta')
    m.name = name
    document.head.appendChild(m)
  }
  m.content = content
}

// The public page a client opens from the link. Shows the schedule and chosen photos only.
export default function ClientView({ token }) {
  const [state, setState] = useState({ status: 'loading' })
  const [open, setOpen] = useState(null)

  useEffect(() => {
    setMeta('robots', 'noindex, nofollow')
    setMeta('referrer', 'no-referrer')
    let live = true
    fetchClientView(token)
      .then((data) => live && setState(data ? { status: 'ok', data } : { status: 'invalid' }))
      .catch(() => live && setState({ status: 'error' }))
    return () => {
      live = false
    }
  }, [token])

  if (state.status === 'loading') return <div className="flex min-h-screen items-center justify-center text-sm text-ink-400">Loading…</div>
  if (state.status !== 'ok') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center" data-testid="client-invalid">
        <h1 className="text-xl font-bold text-ink-900">{state.status === 'error' ? 'Could not load' : 'This link is no longer active'}</h1>
        <p className="mt-2 text-sm text-ink-600">{state.status === 'error' ? 'Please check your connection and try again.' : 'Please ask your builder to send you a new link.'}</p>
      </main>
    )
  }

  const { project, tasks, photos } = state.data
  const pct = overallPercent(tasks)
  const groups = groupByRoom(tasks)

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:py-10" data-testid="client-view">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-600">Progress update</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">{project.name}</h1>
      {(project.start_date || project.end_date) && <p className="mt-1 text-sm text-ink-600">Planned: {fmtDateRange(project.start_date, project.end_date)}</p>}

      <section className="mt-5 rounded-xl border border-ink-100 bg-white p-4" aria-label="Overall progress">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-ink-800">Overall progress</h2>
          <span className="text-lg font-bold text-ink-900">{pct}%</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-status-done" style={{ width: `${pct}%` }} /></div>
      </section>

      <section className="mt-6" aria-label="Schedule">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.08em] text-ink-600">Schedule</h2>
        {groups.length === 0 && <p className="rounded-xl border border-dashed border-ink-200 py-8 text-center text-sm text-ink-600">The schedule will appear here once it is set up.</p>}
        {groups.map((g) => (
          <div key={g.name} className="mb-4">
            <h3 className="mb-1.5 text-sm font-semibold text-ink-900">{g.name}</h3>
            <ul className="space-y-1.5">
              {g.tasks.map((t, i) => {
                const st = CLIENT_STATUS[t.status] || CLIENT_STATUS.todo
                return (
                  <li key={i} className="rounded-lg border border-ink-100 bg-white px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-900">{t.name}</p>
                        <p className="text-xs text-ink-600">{t.status === 'done' && t.actual_end ? `Finished ${fmtDate(t.actual_end)}` : fmtDateRange(t.planned_start, t.planned_end) || 'Dates to be confirmed'}</p>
                      </div>
                      <span className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-ink-50 px-2.5 py-1 text-xs font-medium text-ink-800">
                        <span className="status-dot" style={{ backgroundColor: st.color }} />
                        {st.label}
                      </span>
                    </div>
                    {t.status === 'in_progress' && Number(t.percent) > 0 && (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-status-progress" style={{ width: `${t.percent}%` }} /></div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </section>

      {photos.length > 0 && (
        <section className="mt-6" aria-label="Photos">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.08em] text-ink-600">Photos</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((p) => (
              <button key={p.path} onClick={() => setOpen(p)} className="overflow-hidden rounded-lg border border-ink-100 bg-white text-left" aria-label={`Open photo ${p.room || ''} ${fmtDate(String(p.taken).slice(0, 10))}`}>
                <img src={clientPhotoUrl(p.path)} alt={p.room || 'Site photo'} loading="lazy" className="aspect-square w-full object-cover" />
                <span className="block px-2 py-1 text-xs text-ink-600">{[p.room, fmtDate(String(p.taken).slice(0, 10))].filter(Boolean).join(' · ')}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      <p className="mt-8 text-center text-xs text-ink-400">Shared by your builder. This page shows progress only.</p>

      {open && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/90 p-3" role="dialog" aria-label="Photo" onClick={() => setOpen(null)}>
          <button onClick={() => setOpen(null)} aria-label="Close photo" className="absolute right-3 top-3 min-h-[44px] min-w-[44px] text-3xl leading-none text-white">×</button>
          <img src={clientPhotoUrl(open.path)} alt={open.room || 'Site photo'} className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </main>
  )
}
