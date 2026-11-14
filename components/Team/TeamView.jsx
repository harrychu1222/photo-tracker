import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'

// Admin-only: see everyone with access and promote or demote them, without touching SQL.
export default function TeamView() {
  const { user, isAdmin, company, support, refreshAccount } = useAuth()
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [invites, setInvites] = useState([])
  const [invRole, setInvRole] = useState('crew')
  const [invLabel, setInvLabel] = useState('')
  const [shown, setShown] = useState(null)
  const [coName, setCoName] = useState('')

  const loadInvites = useCallback(async () => {
    const { data } = await supabase
      .from('invite_codes')
      .select('code, label, role, max_uses, uses, expires_at')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
    setInvites((data || []).filter((i) => i.uses < i.max_uses))
  }, [])

  async function makeInvite(e) {
    e.preventDefault()
    setError(null)
    const { data, error } = await supabase.rpc('create_company_invite', {
      p_label: invLabel.trim() || null,
      p_role: invRole,
      p_max_uses: 1,
      p_days: 14
    })
    if (error) return setError(error.message)
    setShown(data)
    setInvLabel('')
    loadInvites()
  }

  async function removeInvite(code) {
    const { error } = await supabase.rpc('revoke_company_invite', { p_code: code })
    if (error) setError(error.message)
    else loadInvites()
  }

  async function renameCo(e) {
    e.preventDefault()
    const { error } = await supabase.rpc('rename_company', { p_name: coName })
    if (error) return setError(error.message)
    setCoName('')
    refreshAccount()
  }

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('email')
    if (error) setError(error.message)
    else {
      setError(null)
      setPeople(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    loadInvites()
  }, [load, loadInvites])

  async function setRole(person, role) {
    const verb = role === 'admin' ? 'make an admin (can see all costs and change roles)' : 'change to crew (cannot see costs)'
    if (!confirm(`${person.email}: ${verb}?`)) return
    setBusyId(person.id)
    setError(null)
    const { error } = await supabase.rpc('set_user_role', { p_user: person.id, p_role: role })
    if (error) {
      setError(
        error.code === 'PGRST202' || error.code === '42883'
          ? 'Team roles are not set up yet. Run supabase/migration_6_materials_equipment_team.sql in Supabase, then reload.'
          : error.message
      )
    } else {
      await load()
    }
    setBusyId(null)
  }

  async function removePerson(person) {
    if (!confirm(`Remove ${person.email}? They lose all access. Their name stays on past tasks and photos, and you can restore them later.`)) return
    setBusyId(person.id)
    setError(null)
    const { error } = await supabase.rpc('remove_company_member', { p_user: person.id })
    if (error) setError(error.code === 'PGRST202' ? 'Removing people is not set up yet. Run migration 27 in Supabase, then reload.' : error.message)
    else await load()
    setBusyId(null)
  }

  async function restorePerson(person) {
    setBusyId(person.id)
    setError(null)
    const { error } = await supabase.rpc('restore_company_member', { p_user: person.id })
    if (error) setError(error.message)
    else await load()
    setBusyId(null)
  }

  const active = people.filter((p) => !p.removed_at)
  const gone = people.filter((p) => p.removed_at)

  if (!isAdmin) {
    return <p className="px-4 py-10 text-center text-sm text-ink-600">Only admins can see the team.</p>
  }

  return (
    <div className="px-4 py-4">
      <h2 className="text-xl font-semibold text-ink-900">Team</h2>
      <p className="mb-4 mt-1 text-sm text-ink-600">
        Admins see costs and manage the team. Crew see tasks, schedules, photos, and materials without prices. To add
        someone, make an invite code below and send it to them.
      </p>

      {error && <p className="mb-3 text-sm text-status-blocked">{error}</p>}
      {loading && <p className="py-8 text-center text-sm text-ink-400">Loading…</p>}

      <ul className="space-y-2">
        {active.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-white p-3">
            <div className="min-w-0">
              <p className="truncate text-base text-ink-900">
                {p.email}
                {p.id === user?.id && <span className="text-ink-400"> (you)</span>}
              </p>
              <span
                className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                  p.role === 'admin' ? 'bg-signal-500/10 text-signal-600' : 'bg-ink-50 text-ink-600'
                }`}
              >
                {p.role === 'admin' ? 'Admin' : 'Crew'}
              </span>
            </div>
            <div className="flex flex-shrink-0 gap-2">
              <button
                onClick={() => setRole(p, p.role === 'admin' ? 'crew' : 'admin')}
                disabled={busyId === p.id}
                className="rounded-lg border border-ink-200 px-3 py-2 text-xs font-medium text-ink-600 disabled:opacity-60"
              >
                {p.role === 'admin' ? 'Make crew' : 'Make admin'}
              </button>
              {p.id !== user?.id && !support && (
                <button
                  onClick={() => removePerson(p)}
                  disabled={busyId === p.id}
                  aria-label={`Remove ${p.email}`}
                  className="rounded-lg border border-ink-200 px-3 py-2 text-xs font-medium text-status-blocked disabled:opacity-60"
                >
                  Remove
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {gone.length > 0 && !support && (
        <>
          <h3 className="mb-2 mt-6 text-sm font-semibold text-ink-900">Removed people</h3>
          <ul className="space-y-1">
            {gone.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-xs text-ink-600">
                <span className="min-w-0 truncate">{p.email}</span>
                <button
                  onClick={() => restorePerson(p)}
                  disabled={busyId === p.id}
                  aria-label={`Restore ${p.email}`}
                  className="flex-shrink-0 rounded-lg border border-ink-200 px-2 py-1 font-medium"
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {!support && (
        <>
          <h3 className="mb-2 mt-6 text-sm font-semibold text-ink-900">Invite someone</h3>
          <form onSubmit={makeInvite} className="rounded-xl border border-ink-100 bg-white p-3">
            <div className="flex flex-wrap gap-2">
              <input
                aria-label="Who is it for"
                value={invLabel}
                onChange={(e) => setInvLabel(e.target.value)}
                placeholder="Who is it for (optional)"
                className="min-w-0 flex-1 rounded-lg border border-ink-200 px-3 py-2 text-base"
              />
              <select
                aria-label="Role"
                value={invRole}
                onChange={(e) => setInvRole(e.target.value)}
                className="rounded-lg border border-ink-200 px-3 py-2 text-base"
              >
                <option value="crew">Crew</option>
                <option value="admin">Admin</option>
              </select>
              <button className="rounded-lg bg-signal-500 px-4 py-2 text-sm font-medium text-white">Make code</button>
            </div>
            {shown && (
              <p className="mt-3 text-sm text-ink-900">
                Send them this code (one use, 14 days): <span className="select-all font-mono font-semibold">{shown}</span>
              </p>
            )}
          </form>
          {invites.length > 0 && (
            <ul className="mt-2 space-y-1">
              {invites.map((i) => (
                <li key={i.code} className="flex items-center justify-between gap-2 text-xs text-ink-600">
                  <span className="min-w-0 truncate">
                    <span className="font-mono">{i.code}</span> · {i.role === 'admin' ? 'Admin' : 'Crew'}
                    {i.label ? ` · ${i.label}` : ''}
                  </span>
                  <button onClick={() => removeInvite(i.code)} className="flex-shrink-0 rounded-lg border border-ink-200 px-2 py-1 font-medium">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mb-2 mt-6 text-sm font-semibold text-ink-900">Company name</h3>
          <form onSubmit={renameCo} className="flex gap-2">
            <input
              aria-label="Company name"
              value={coName}
              onChange={(e) => setCoName(e.target.value)}
              placeholder={company?.name || 'Company name'}
              className="min-w-0 flex-1 rounded-lg border border-ink-200 px-3 py-2 text-base"
            />
            <button className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-600">Rename</button>
          </form>
        </>
      )}
      <p className="mt-4 text-xs text-ink-400">
        A person's new role applies the next time they open or reload the app. There must always be at least one admin.
      </p>
    </div>
  )
}
