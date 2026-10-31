import Icon from '../ui/Icon'
import { buildAgenda } from '../../lib/agenda'
import { fmtDate } from '../../lib/format'

function dayParts(date) {
  const d = new Date(`${date}T00:00:00`)
  return { num: d.getDate(), word: d.toLocaleDateString(undefined, { weekday: 'short' }) }
}

// Phone view of the schedule: a date rail with what is due each day.
export default function AgendaView({ tasks, materials, today, roomsById, onOpenTask }) {
  const days = buildAgenda(tasks, materials, today)
  if (days.length === 0) {
    return <p className="rounded-xl border border-dashed border-ink-200 bg-white py-8 text-center text-sm text-ink-600">Nothing is due. Tasks need planned dates, and deliveries an expected date.</p>
  }
  return (
    <ol className="space-y-1" data-testid="agenda">
      {days.map((day) => {
        const p = day.date ? dayParts(day.date) : null
        return (
          <li key={day.key} className="flex gap-3" data-testid={`agenda-${day.key}`}>
            <div className="w-12 flex-none pt-3 text-center">
              {day.overdue ? (
                <span className="inline-block rounded-md bg-[#F6DAD4] px-1.5 py-0.5 text-[10px] font-bold text-[#7A2A1D]">Overdue</span>
              ) : (
                <>
                  <p className={`text-xl font-bold leading-none ${day.isToday ? 'rounded-lg bg-status-blocked py-1.5 text-white' : 'text-ink-900'}`}>{p.num}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-ink-600">{day.isToday ? 'Today' : p.word}</p>
                </>
              )}
            </div>
            <ul className="min-w-0 flex-1 space-y-2 border-l-2 border-ink-100 pb-3 pl-3">
              {day.items.map((it) => {
                const isTask = it.kind === 'task'
                const room = isTask ? roomsById[it.task.room_id]?.name : null
                return (
                  <li key={it.id}>
                    <button
                      onClick={isTask ? () => onOpenTask(it.task.id) : undefined}
                      className={`flex min-h-[56px] w-full items-center gap-3 rounded-xl border bg-white px-3 py-2 text-left ${it.late ? 'border-status-blocked' : 'border-ink-100'}`}
                    >
                      <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg ${it.late ? 'bg-[#F6DAD4] text-[#7A2A1D]' : isTask ? 'bg-[#FBEAD2] text-[#7A4B05]' : 'bg-ink-100 text-ink-800'}`}>
                        <Icon name={isTask ? (it.late ? 'alert' : 'calendar') : 'truck'} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink-900">{isTask ? it.task.name : `${it.material.name} delivery`}</span>
                        <span className="block truncate text-xs text-ink-600">
                          {isTask
                            ? [room, it.late ? `due ${fmtDate(it.date)}` : `${it.task.percent_complete || 0}% done`].filter(Boolean).join(' · ')
                            : `Expected ${fmtDate(it.date)}${it.late ? ', not arrived' : ''}`}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </li>
        )
      })}
    </ol>
  )
}
