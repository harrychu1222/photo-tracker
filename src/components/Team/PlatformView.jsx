import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'

// App owner only: the companies using the app, a read-only look inside one (with a reason, logged),
// suspend/reactivate, and the log of every look.
export default function PlatformView() {
  const { isOwner, support, startSupport, stopSupport } = useAuth()
  const [companies, setCompanies] = useState([])
  const [log, setLog] = useState([])
  const [error, setError] = useState(null)
  const [name, setName] = useState('')
  const [newCode, setNewCode] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [c, l] = await Promise.all([supabase.rpc('platform_companies'), supabase.rpc('platform_audit_log', { p_limit: 50 })])
    if (c.error) setError(c.error.message)
    else {
      setError(null)
      setCompanies(c.data || [])
    }
    if (!l.error) setLog(l.data || [])
  }, [])

  useEffect(() => {
    if (isOwner) load()
  }, [isOwner, load])

  if (!isOwner) return <p className="px-4 py-10 text-center text-sm text-ink-600">Only the app owner can open this.</p>

  async function create(e) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    const { data, error } = await supabase.rpc('platform_create_company', { p_name: name })
    setBusy(false)
    if (error) return setError(error.message)
    setNewCode({ company: name.trim(), code: data })
    setName('')
    load()
  }

  async function look(c) {
    const reason = prompt(`Why are you looking inside ${c.name}? (kept in the log)`)
    if (!reason || reason.trim().length < 3) return
    const err = await startSupport(c.company_id, reason.trim())
    if (err) setError(err.message)
  }

  async function setStatus(c) {
    const next = c.status === 'active' ? 'suspended' : 'active'
    if (!confirm(next === 'suspended' ? `Lock ${c.name} out until you reactivate it?` : `Reactivate ${c.name}?`)) return
    const { error } = await supabase.rpc('platform_set_company_status', { p_company: c.company_id, p_status: next })
    if (error) setError(error.message)
    else load()
  }

  return (
    <div className="px-4 py-4">
      <h2 className="text-xl font-semibold text-ink-900">Platform</h2>
      <p className="mb-4 mt-1 text-sm text-ink-600">
        Companies using the app. Looking inside a company is read-only, needs a reason, and is logged.
      </p>
      {error && <p className="mb-3 text-sm text-status-blocked">{error}</p>}

      {support && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-white p-3">
          <p className="text-sm text-ink-900">Viewing {support.companyName}</p>
          <button onClick={stopSupport} className="rounded-lg border border-ink-200 px-3 py-2 text-xs font-medium text-ink-600">
            Stop viewing
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {companies.map((c) => (
          <li key={c.company_id} className="rounded-xl border border-ink-100 bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base text-ink-900">{c.name}</p>
                <p className="text-xs text-ink-600">
                  {c.people} people ({c.managers} managers) · {c.projects} projects
                  {c.status === 'suspended' && <span className="ml-1 font-medium text-status-blocked">· Suspended</span>}
                </p>
              </div>
              <div className="flex flex-shrink-0 gap-2">
                <button onClick={() => look(c)} className="rounded-lg border border-ink-200 px-3 py-2 text-xs font-medium text-ink-600">
                  View inside
                </button>
                <button onClick={() => setStatus(c)} className="rounded-lg border border-ink-200 px-3 py-2 text-xs font-medium text-ink-600">
                  {c.status === 'active' ? 'Suspend' : 'Reactivate'}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={create} className="mt-5 rounded-xl border border-ink-100 bg-white p-3">
        <label htmlFor="newco" className="mb-1 block text-sm font-medium text-ink-800">
          Add a company
        </label>
        <div className="flex gap-2">
          <input
            id="newco"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Company name"
            className="min-w-0 flex-1 rounded-lg border border-ink-200 px-3 py-2 text-base"
          />
          <button disabled={busy} className="rounded-lg bg-signal-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            Create
          </button>
        </div>
        {newCode && (
          <p className="mt-3 text-sm text-ink-900">
            Invite code for {newCode.company}'s first manager (one use, 14 days):{' '}
            <span className="select-all font-mono font-semibold">{newCode.code}</span>
          </p>
        )}
      </form>

      <h3 className="mb-2 mt-6 text-sm font-semibold text-ink-900">Access log</h3>
      {log.length === 0 ? (
        <p className="text-sm text-ink-400">Nothing yet.</p>
      ) : (
        <ul className="space-y-1">
          {log.map((l, i) => (
            <li key={i} className="text-xs text-ink-600">
              {new Date(l.at).toLocaleString()} · {l.action.replace('_', ' ')} · {l.company_name}
              {l.reason ? ` · ${l.reason}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
