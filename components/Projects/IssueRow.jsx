import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useWork } from '../../context/WorkContext'
import { fmtDate } from '../../lib/format'
import { todayLocal } from '../../lib/tasks'

const inputClass = 'w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-base focus:border-signal-500'

// One diary issue. Managers set it resolved or open, the date, and a comment.
export default function IssueRow({ issue, onError }) {
  const { user, isAdmin } = useAuth()
  const { updateIssue, deleteIssue } = useWork()
  const [open, setOpen] = useState(false)
  const [resolved, setResolved] = useState(!!issue.resolved)
  const [date, setDate] = useState(issue.resolved_on || todayLocal())
  const [comment, setComment] = useState(issue.comment || '')
  const run = async (fn) => {
    onError(null)
    try {
      await fn()
    } catch (err) {
      onError(err.message)
    }
  }
  return (
    <li className={`rounded-lg px-2.5 py-1.5 text-sm ${issue.resolved ? 'bg-[#E3F2E4] text-[#1E5B26]' : 'bg-[#FBEAD2] text-[#7A4B05]'}`} data-testid={`issue-${issue.id}`}>
      <p>
        <span className="font-semibold">{issue.resolved ? `Resolved ${fmtDate(issue.resolved_on)}` : 'Open'}:</span> {issue.text}
      </p>
      {issue.comment && <p className="text-xs">Comment: {issue.comment}</p>}
      <div className="flex gap-3">
        {isAdmin && !issue.pending && <button onClick={() => setOpen((o) => !o)} className="min-h-[40px] text-xs font-medium underline" aria-label={`Update issue ${issue.text}`}>Update</button>}
        {!issue.pending && (isAdmin || issue.created_by === user?.id) && (
          <button onClick={() => run(() => deleteIssue(issue.id))} className="min-h-[40px] text-xs font-medium underline opacity-70" aria-label={`Delete issue ${issue.text}`}>Delete</button>
        )}
      </div>
      {open && isAdmin && (
        <div className="mb-1 space-y-2 rounded-lg bg-white p-2 text-ink-900">
          <label className="block text-xs font-medium">
            Status
            <select value={resolved ? 'resolved' : 'open'} onChange={(e) => setResolved(e.target.value === 'resolved')} className={inputClass} aria-label="Issue status">
              <option value="open">Not resolved</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>
          {resolved && (
            <label className="block text-xs font-medium">
              Resolved on
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} aria-label="Resolved on" />
            </label>
          )}
          <label className="block text-xs font-medium">
            Comment
            <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} className={inputClass} aria-label="Issue comment" placeholder="e.g. Tiles arrived Friday" />
          </label>
          <button onClick={() => run(async () => { await updateIssue(issue.id, { resolved, resolvedOn: date, comment }); setOpen(false) })} className="min-h-[44px] rounded-lg bg-ink-900 px-4 text-sm font-semibold text-white">Save</button>
        </div>
      )}
    </li>
  )
}
