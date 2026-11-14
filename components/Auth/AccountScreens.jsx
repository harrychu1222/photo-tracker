import { useState } from 'react'
import { supabase } from '../../supabaseClient'

const input = 'w-full rounded-lg border border-ink-200 px-3 py-2.5 text-base focus:border-signal-500'
const primary = 'w-full rounded-lg bg-ink-900 py-3 text-base font-medium text-white disabled:opacity-60'

// Step 1 of a password reset: ask for the email, Supabase sends a link.
export function ForgotPassword({ onBack }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
    setBusy(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-app flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold text-ink-900">Reset your password</h1>
      {sent ? (
        <p className="mt-3 text-sm text-ink-600">
          If {email} has an account, a reset link is on its way. Open it on this phone, then choose a new password.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-800" htmlFor="reset-email">
              Email
            </label>
            <input id="reset-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          </div>
          {error && <p className="text-sm text-status-blocked">{error}</p>}
          <button type="submit" disabled={busy} className={primary}>
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
      <button onClick={onBack} className="mt-6 text-center text-sm font-medium text-signal-600 underline underline-offset-2">
        Back to sign in
      </button>
    </div>
  )
}

// Step 2: the person arrived from the email link and is signed in just to choose a new password.
export function SetNewPassword({ onDone }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (pw.length < 8) return setError('Use at least 8 characters.')
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) setError(error.message)
    else onDone()
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-app flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold text-ink-900">Choose a new password</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-800" htmlFor="new-pw">
            New password
          </label>
          <input id="new-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className={input} />
        </div>
        {error && <p className="text-sm text-status-blocked">{error}</p>}
        <button type="submit" disabled={busy} className={primary}>
          {busy ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </div>
  )
}

// Shown to a person a manager has removed from the company.
export function RemovedScreen({ onSignOut }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-app flex-col justify-center px-6 text-center">
      <h1 className="text-xl font-semibold text-ink-900">You no longer have access</h1>
      <p className="mt-2 text-sm text-ink-600">A manager has removed you from this company. If this is a mistake, ask them to restore you.</p>
      <button onClick={onSignOut} className="mt-6 font-medium text-signal-600 underline underline-offset-2">
        Sign out
      </button>
    </div>
  )
}
