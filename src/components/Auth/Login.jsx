import { useState } from 'react'
import { supabase } from '../../supabaseClient'

export default function Login({ onSwitchToSignUp }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError(error.message)
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-app flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold text-ink-900">Site Log</h1>
      <p className="mt-1 text-sm text-ink-600">Sign in to see and add site photos.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-800" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-base focus:border-signal-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-800" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-base focus:border-signal-500"
          />
        </div>

        {error && <p className="text-sm text-status-blocked">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-ink-900 py-3 text-base font-medium text-white disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-600">
        Have an invite code?{' '}
        <button onClick={onSwitchToSignUp} className="font-medium text-signal-600 underline underline-offset-2">
          Create an account
        </button>
      </p>
    </div>
  )
}
