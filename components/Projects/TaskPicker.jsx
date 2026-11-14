import { useWork } from '../../context/WorkContext'

const fieldClass =
  'w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-base focus:border-signal-500'

// Pick one of a project's tasks (or none). `value` is a task id ('' = none).
export default function TaskPicker({ projectId, value, onChange }) {
  const { tasksByProject, roomsById } = useWork()
  const tasks = tasksByProject[projectId] || []

  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={fieldClass}>
      <option value="">No task</option>
      {tasks.map((t) => {
        const room = t.room_id ? roomsById[t.room_id]?.name : ''
        return (
          <option key={t.id} value={t.id}>
            {room ? `${t.name} (${room})` : t.name}
          </option>
        )
      })}
    </select>
  )
}
