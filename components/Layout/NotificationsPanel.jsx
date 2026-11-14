import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationsContext'
import { useProjects } from '../../hooks/useProjects'
import { kindsFor } from '../../lib/notifyKinds'
import { enablePush, disablePush, pushEnabled, pushSupport } from '../../lib/push'

const inputClass = 'w-24 rounded-lg border border-ink-200 bg-white px-3 py-2 text-base focus:border-signal-500'

function ago(iso) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins} min ago`
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`
  return `${Math.round(mins / 1440)} d ago`
}

function Toggle({ label, checked, onChange, disabled }) {
  return (
    <label className="flex min-h-[44px] items-center justify-between gap-3 text-sm text-ink-900">
      <span>{label}</span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5" />
    </label>
  )
}

function List({ onOpen }) {
  const { items, unread, markRead, markAllRead } = useNotifications()
  return (
    <div>
      {unread > 0 && (
        <button onClick={markAllRead} className="mb-2 min-h-[44px] text-sm font-semibold text-ink-900 underline">Mark all as read</button>
      )}
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-200 py-10 text-center text-sm text-ink-600">Nothing yet. Updates about your jobs will show up here.</p>
      ) : (
        <ul className="space-y-2" data-testid="notification-list">
          {items.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => {
                  markRead(n.id)
                  if (n.project_id) onOpen(n.project_id, n.tab)
                }}
                className={`w-full rounded-xl border p-3 text-left ${n.read_at ? 'border-ink-100 bg-white' : 'border-signal-500 bg-[#FFF8E6]'}`}
                aria-label={`${n.title}${n.read_at ? '' : ' (unread)'}`}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-ink-900">{n.title}</span>
                  <span className="flex-none text-xs text-ink-600">{ago(n.created_at)}</span>
                </span>
                {n.body && <span className="mt-0.5 block whitespace-pre-line text-sm text-ink-800">{n.body}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Settings() {
  const { user, isAdmin } = useAuth()
  const { prefs, setKind, savePrefs, muted, setMute } = useNotifications()
  const { projects } = useProjects(user?.id, isAdmin)
  const [pushOn, setPushOn] = useState(false)
  const [error, setError] = useState(null)
  const [days, setDays] = useState({ v: String(prefs.variation_days), d: String(prefs.defect_days) })
  const support = pushSupport()
  useEffect(() => {
    pushEnabled().then(setPushOn)
  }, [])
  const act = async (fn) => {
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err.message)
    }
  }
  const mutedProjects = projects.filter((p) => muted.has(p.id))
  const saveDays = () => act(async () => {
    const v = Math.min(60, Math.max(1, parseInt(days.v, 10) || 3))
    const d = Math.min(90, Math.max(1, parseInt(days.d, 10) || 7))
    setDays({ v: String(v), d: String(d) })
    await savePrefs({ variation_days: v, defect_days: d })
  })

  return (
    <div className="space-y-5">
      {error && <p className="text-sm text-status-blocked" role="alert">{error}</p>}
      <section>
        <h3 className="mb-1 text-sm font-semibold text-ink-900">On this phone</h3>
        {support === 'no-key' ? (
          <p className="text-sm text-ink-600">Phone alerts are not switched on for this app yet. You still get everything in the bell.</p>
        ) : support === 'unsupported' ? (
          <p className="text-sm text-ink-600">Phone alerts need the app on your Home Screen. On iPhone: Share, then Add to Home Screen, then open Site Log from there.</p>
        ) : (
          <Toggle label="Send alerts to this phone" checked={pushOn} disabled={support === 'denied' && !pushOn} onChange={(on) => act(async () => { if (on) await enablePush(user.id); else await disablePush(); setPushOn(on) })} />
        )}
        {support === 'denied' && <p className="text-xs text-ink-600">Alerts are blocked for this app in your phone settings.</p>}
      </section>
      <section>
        <h3 className="mb-1 text-sm font-semibold text-ink-900">Tell me when</h3>
        <div className="divide-y divide-ink-100 rounded-xl border border-ink-100 bg-white px-3">
          {kindsFor(isAdmin).map((k) => {
            const cur = prefs.kinds[k.id] || {}
            const app = cur.app !== false
            const push = cur.push ?? k.push
            return (
              <div key={k.id} className="py-1">
                <Toggle label={k.label} checked={app} onChange={(v) => act(() => setKind(k.id, { app: v }))} />
                {app && support === 'ok' && (
                  <label className="mb-1 flex items-center gap-2 pl-4 text-xs text-ink-600">
                    <input type="checkbox" checked={push} onChange={(e) => act(() => setKind(k.id, { push: e.target.checked }))} className="h-4 w-4" aria-label={`Phone alert for ${k.label}`} />
                    Also send to my phone
                  </label>
                )}
              </div>
            )
          })}
        </div>
      </section>
      {isAdmin && (
        <section>
          <h3 className="mb-1 text-sm font-semibold text-ink-900">Morning summary</h3>
          <Toggle label="Also email it to me at 7am" checked={prefs.email_morning} onChange={(v) => act(() => savePrefs({ email_morning: v }))} />
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-900">
            <label htmlFor="nt-var">Variation waiting for a yes after</label>
            <input id="nt-var" inputMode="numeric" value={days.v} onChange={(e) => setDays((d) => ({ ...d, v: e.target.value }))} onBlur={saveDays} className={inputClass} />
            <span>days</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-900">
            <label htmlFor="nt-def">Defect still open after</label>
            <input id="nt-def" inputMode="numeric" value={days.d} onChange={(e) => setDays((d) => ({ ...d, d: e.target.value }))} onBlur={saveDays} className={inputClass} />
            <span>days</span>
          </div>
        </section>
      )}
      <section>
        <h3 className="mb-1 text-sm font-semibold text-ink-900">Muted jobs</h3>
        {mutedProjects.length === 0 ? (
          <p className="text-sm text-ink-600">None. To mute a job, open it and tap Mute alerts.</p>
        ) : (
          <ul className="space-y-1">
            {mutedProjects.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-sm text-ink-900">
                <span className="truncate">{p.name}</span>
                <button onClick={() => act(() => setMute(p.id, false))} className="min-h-[44px] px-2 text-sm font-semibold underline" aria-label={`Unmute ${p.name}`}>Unmute</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default function NotificationsPanel({ onClose, onOpen }) {
  const [view, setView] = useState('list')
  const tabBtn = (id, label) => (
    <button onClick={() => setView(id)} aria-pressed={view === id} className={`min-h-[44px] flex-1 rounded-lg text-sm font-semibold ${view === id ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-800'}`}>{label}</button>
  )
  return (
    <div role="dialog" aria-label="Notifications" className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="flex max-h-[88vh] w-full max-w-md flex-col rounded-t-2xl bg-white p-4 sm:rounded-2xl">
        <h2 className="text-lg font-semibold text-ink-900">Notifications</h2>
        <div className="my-3 flex gap-2">
          {tabBtn('list', 'Updates')}
          {tabBtn('settings', 'Settings')}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {view === 'list' ? <List onOpen={(id, tab) => { onClose(); onOpen(id, tab) }} /> : <Settings />}
        </div>
        <button onClick={onClose} className="mt-3 min-h-[44px] rounded-lg bg-ink-900 text-sm font-semibold text-white">Close</button>
      </div>
    </div>
  )
}
