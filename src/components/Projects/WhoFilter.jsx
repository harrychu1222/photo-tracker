import { useAuth } from '../../context/AuthContext'
import { useWork } from '../../context/WorkContext'
import { personName } from '../../lib/people'

// "Assigned to" filter for the task list and board. Hidden when there is only one person.
export default function WhoFilter({ who, onWho }) {
  const { user } = useAuth()
  const { team } = useWork()
  if (team.length < 2) return null
  return (
    <select value={who} onChange={(e) => onWho(e.target.value)} aria-label="Assigned to filter" className="mb-3 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm md:max-w-xs">
      <option value="all">Everyone's tasks</option>
      <option value="me">Assigned to me</option>
      <option value="none">Not assigned</option>
      {team.filter((m) => m.id !== user?.id).map((m) => <option key={m.id} value={m.id}>{personName(m.email)}</option>)}
    </select>
  )
}
