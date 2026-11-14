import { NO_LEVEL, levelsOf } from '../../lib/levels'

const chip = (on) => `whitespace-nowrap min-h-[36px] rounded-full border px-3.5 text-sm font-medium ${on ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white text-ink-600'}`

// Level chips (All levels, Ground, Level 1 ...). Shows nothing until a room has a level.
export default function LevelFilter({ rooms, level, onLevel }) {
  const levels = levelsOf(rooms)
  if (levels.length === 0) return null
  const mixed = rooms.some((r) => !r.level)
  return (
    <div className="mb-3 flex gap-1.5 overflow-x-auto" role="group" aria-label="Level filter">
      <button onClick={() => onLevel('all')} className={chip(level === 'all')} aria-pressed={level === 'all'}>All levels</button>
      {levels.map((l) => (
        <button key={l} onClick={() => onLevel(level === l ? 'all' : l)} className={chip(level === l)} aria-pressed={level === l}>{l}</button>
      ))}
      {mixed && <button onClick={() => onLevel(level === NO_LEVEL ? 'all' : NO_LEVEL)} className={chip(level === NO_LEVEL)} aria-pressed={level === NO_LEVEL}>No level</button>}
    </div>
  )
}
