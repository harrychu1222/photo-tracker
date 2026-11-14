import { useState } from 'react'
import { supabase } from '../../supabaseClient'

// Anyone signed in can send a note to the app owner: a problem, an idea, a question.
export default function FeedbackDialog({ onClose, page }) {
  const [message, setMessage] = useState('')
  const [state, setState] = useState('idle') // idle | sending | sent
  const [error, setError] = useState(null)

  async function send(e) {
    e.preventDefault()
    if (!message.trim()) return
    setState('sending')
    setError(null)
    const { error } = await supabase.from('feedback').insert({ message: message.trim(), page })
    if (error) {
      setState('idle')
      setError(
        error.code === 'PGRST205' || error.code === '42P01'
          ? 'Feedback is not set up yet. Ask the app owner to run migration 27.'
          : error.message
      )
    } else setState('sent')
  }

  return (
    <div role="dialog" aria-label="Send feedback" className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-4 sm:rounded-2xl">
        <h2 className="text-lg font-semibold text-ink-900">Send feedback</h2>
        {state === 'sent' ? (
          <>
            <p className="mt-2 text-sm text-ink-600">Thanks, we got it.</p>
            <button onClick={onClose} className="mt-4 w-full rounded-lg bg-ink-900 py-3 text-base font-medium text-white">
              Close
            </button>
          </>
        ) : (
          <form onSubmit={send}>
            <p className="mt-1 text-sm text-ink-600">A problem, an idea or a question. Tell us what you were doing.</p>
            <textarea
              aria-label="Your feedback"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={4000}
              className="mt-3 w-full rounded-lg border border-ink-200 px-3 py-2 text-base"
            />
            {error && <p className="mt-2 text-sm text-status-blocked">{error}</p>}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-ink-200 py-3 text-base font-medium text-ink-600">
                Cancel
              </button>
              <button
                type="submit"
                disabled={state === 'sending' || !message.trim()}
                className="flex-1 rounded-lg bg-ink-900 py-3 text-base font-medium text-white disabled:opacity-60"
              >
                {state === 'sending' ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
