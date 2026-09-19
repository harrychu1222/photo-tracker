import { useState } from 'react'
import { supabase } from '../../supabaseClient'

export default function SignUp({ onSwitchToLogin }) {
  const [inviteCode, setInviteCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { invite_code: inviteCode.trim() } }
    })

    setLoading(false)

    if (error) {
      // The invite-code trigger raises a Postgres exception; Supabase surfaces
      // it here as a generic message, so we soften the wording a bit.
      setError(error.message.includes('Database error') ? 'Invalid or expired invite code.' : error.message)
      return
    }

    setDone(true)
  }

  if (done) {
    return (
      <div className="mx-auto flex min-h-screen max-w-app flex-col justify-center px-6 text-center">
        <h1 className="text-xl font-semibold text-ink-900">Check your email</h1>
        <p className="mt-2 text-sm text-ink-600">
          We sent a confirmation link to {email}. Follow it, then come back and sign in.
        </p>
        <button onClick={onSwitchToLogin} className="mt-6 font-medium text-signal-600 underline underline-offset-2">
          Back to sign in
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-app flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold text-ink-900">Create an account</h1>
      <p className="mt-1 text-sm text-ink-600">You'll need the invite code you were given.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-800" htmlFor="invite">
            Invite code
          </label>
          <input
            id="invite"
            required
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-base uppercase tracking-wide focus:border-signal-500"
          />
        </div>
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
            minLength={6}
            autoComplete="new-password"
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
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-600">
        Already have an account?{' '}
        <button onClick={onSwitchToLogin} className="font-medium text-signal-600 underline underline-offset-2">
          Sign in
        </button>
      </p>
    </div>
  )
}
