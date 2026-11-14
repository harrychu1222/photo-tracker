import Icon from '../ui/Icon'
import PhotoCard from '../Photos/PhotoCard'
import MoneyBox from './MoneyBox'
import { useMedia } from '../../hooks/useMedia'
import { fmtDateRange, fmtMoney } from '../../lib/format'
import { fmtHours } from '../../lib/tasks'

function Tile({ label, value, sub, bar, barColor = '#3E8E5D', tone, testId }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-4" data-testid={testId}>
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-600">{label}</p>
      <p className={`mt-1 text-2xl font-bold tracking-tight ${tone === 'bad' ? 'text-[#7A2A1D]' : 'text-ink-900'}`}>{value}</p>
      {bar != null && (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, bar))}%`, backgroundColor: barColor }} />
        </div>
      )}
      <p className="mt-2 text-xs text-ink-600">{sub}</p>
    </div>
  )
}

function Detail({ label, children, testId }) {
  if (!children) return null
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink-400">{label}</p>
      <p className="whitespace-pre-line text-sm text-ink-900" data-testid={testId}>{children}</p>
    </div>
  )
}

export default function OverviewTab({
  project,
  isAdmin,
  money,
  paid,
  progress,
  schedule,
  attention,
  labour,
  hoursLogged,
  photos,
  dates,
  actualDates,
  onGo,
  onOpenPhoto
}) {
  const wide = useMedia('(min-width: 1024px)')
  const spentPct = money.target > 0 ? Math.round((money.actual / money.target) * 100) : null
  const recent = photos.slice(0, 4)

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem] lg:gap-6">
      <div className="min-w-0 space-y-4">
        <div className={`grid gap-3 ${isAdmin ? 'grid-cols-2 xl:grid-cols-4' : 'grid-cols-2'}`}>
          <Tile
            testId="tile-progress"
            label="Progress"
            value={`${progress.percent}%`}
            bar={progress.percent}
            sub={progress.total ? `${progress.done} of ${progress.total} tasks done` : 'No tasks yet'}
          />
          <Tile
            testId="tile-schedule"
            label="Schedule"
            value={schedule.behindDays > 0 ? `${schedule.behindDays} day${schedule.behindDays === 1 ? '' : 's'} behind` : progress.total ? 'On schedule' : '—'}
            tone={schedule.behindDays > 0 ? 'bad' : undefined}
            sub={dates || 'No planned dates yet'}
          />
          {isAdmin ? (
            <>
              <Tile
                testId="tile-spent"
                label="Spent"
                value={fmtMoney(money.actual)}
                bar={spentPct}
                barColor="#D98E1F"
                sub={money.target != null ? `${spentPct}% of ${fmtMoney(money.target)} target` : 'No target set'}
              />
              <Tile
                testId="tile-received"
                label="Received"
                value={fmtMoney(paid.received)}
                bar={money.quote > 0 ? (paid.received / money.quote) * 100 : null}
                barColor="#1F2A37"
                sub={money.quote != null ? `of ${fmtMoney(money.quote)} quote` : 'No quote price yet'}
              />
            </>
          ) : (
            <Tile testId="tile-hours" label="My hours" value={fmtHours(hoursLogged)} sub="Logged on this project" />
          )}
        </div>

        <section className="rounded-xl border border-ink-100 bg-white" aria-label="Needs attention" data-testid="attention">
          <h3 className="px-4 pt-4 text-xs font-bold uppercase tracking-[0.08em] text-ink-600">Needs attention</h3>
          {attention.length === 0 ? (
            <p className="flex items-center gap-2 px-4 py-4 text-sm text-ink-600">
              <Icon name="check" className="text-status-done" /> Nothing needs attention right now.
            </p>
          ) : (
            <ul className="mt-2 pb-2">
              {attention.map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => onGo(a.go.tab, a.go.sub)}
                    className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left hover:bg-ink-50"
                  >
                    <span
                      className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg ${
                        a.tone === 'bad' ? 'bg-[#F6DAD4] text-[#7A2A1D]' : 'bg-[#FBEAD2] text-[#7A4B05]'
                      }`}
                    >
                      <Icon name={a.id.startsWith('mat') ? 'truck' : a.id === 'spend' ? 'money' : 'alert'} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink-900">{a.title}</span>
                      <span className="block truncate text-xs text-ink-600">{a.detail}</span>
                    </span>
                    <Icon name="next" className="text-ink-400" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {isAdmin && !wide && <MoneyBox money={money} paid={paid} labourHours={labour.hours} />}

        <section className="rounded-xl border border-ink-100 bg-white p-4" aria-label="Recent photos">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-600">Recent photos</h3>
            {photos.length > 4 && (
              <button onClick={() => onGo('photos')} className="min-h-[44px] text-sm font-medium text-signal-600">
                See all {photos.length}
              </button>
            )}
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-ink-600">No photos linked to this project yet. Pick this project when you add photos.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {recent.map((photo) => (
                <PhotoCard key={photo.id} photo={photo} onOpen={onOpenPhoto} />
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-4">
        {isAdmin && wide && <MoneyBox money={money} paid={paid} labourHours={labour.hours} />}
        <section className="space-y-3 rounded-xl border border-ink-100 bg-white p-4" aria-label="Project details">
          <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-600">Details</h3>
          <Detail label="Client">{project.client}</Detail>
          <Detail label="Site address">{project.site_address}</Detail>
          <Detail label="Planned" testId="planned-dates">{dates}</Detail>
          <Detail label="Actual" testId="actual-dates">{actualDates}</Detail>
          <Detail label="Notes">{project.notes}</Detail>
          {!project.client && !project.site_address && !dates && !actualDates && !project.notes && (
            <p className="text-sm text-ink-600">No details added yet. Use Edit to add them.</p>
          )}
        </section>
      </aside>
    </div>
  )
}
