import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'

// Admin-only: see everyone with access and promote or demote them, without touching SQL.
export default function TeamView() {
  const { user, isAdmin } = useAuth()
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('id, email, role, created_at').order('email')
    if (error) setError(error.message)
    else {
      setError(null)
      setPeople(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

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

  if (!isAdmin) {
    return <p className="px-4 py-10 text-center text-sm text-ink-600">Only admins can see the team.</p>
  }

  return (
    <div className="px-4 py-4">
      <h2 className="text-xl font-semibold text-ink-900">Team</h2>
      <p className="mb-4 mt-1 text-sm text-ink-600">
        Admins see costs and manage the team. Crew see tasks, schedules, photos, and materials without prices. To invite
        someone, share an invite code (see the README).
      </p>

      {error && <p className="mb-3 text-sm text-status-blocked">{error}</p>}
      {loading && <p className="py-8 text-center text-sm text-ink-400">Loading…</p>}

      <ul className="space-y-2">
        {people.map((p) => (
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
            <button
              onClick={() => setRole(p, p.role === 'admin' ? 'crew' : 'admin')}
              disabled={busyId === p.id}
              className="flex-shrink-0 rounded-lg border border-ink-200 px-3 py-2 text-xs font-medium text-ink-600 disabled:opacity-60"
            >
              {p.role === 'admin' ? 'Make crew' : 'Make admin'}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-ink-400">
        A person's new role applies the next time they open or reload the app. There must always be at least one admin.
      </p>
    </div>
  )
}
