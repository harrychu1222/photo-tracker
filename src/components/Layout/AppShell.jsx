import Icon from '../ui/Icon'
import { projectStatusMeta } from '../../statusConfig'

function Brand() {
  return (
    <div className="flex items-center gap-2.5 font-bold text-white">
      <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-signal-500 text-ink-950">
        <Icon name="logo" size={16} strokeWidth={2.2} />
      </span>
      Site Log
    </div>
  )
}

// Desktop: a dark side menu with the active projects. Phone: a top bar and a bottom nav
// with the Add photo button in the middle.
export default function AppShell({
  isDesktop,
  tab,
  onTab,
  isAdmin,
  email,
  onSignOut,
  onAddPhoto,
  projects,
  selectedId,
  onOpenProject,
  children
}) {
  const navItems = [
    { id: 'projects', label: 'Projects', icon: 'projects' },
    { id: 'photos', label: 'Photos', icon: 'photos' },
    ...(isAdmin ? [{ id: 'team', label: 'Team', icon: 'team' }] : [])
  ]

  if (isDesktop) {
    const active = projects.filter((p) => p.status === 'active' || p.status === 'quoting').slice(0, 8)
    return (
      <div className="flex min-h-screen bg-ink-50">
        <aside className="sticky top-0 flex h-screen w-[232px] flex-none flex-col gap-6 overflow-y-auto bg-ink-950 px-3 py-5">
          <div className="px-2">
            <Brand />
          </div>
          <nav aria-label="Main" className="flex flex-col gap-1">
            <p className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400">Workspace</p>
            {navItems.map((n) => (
              <button
                key={n.id}
                onClick={() => onTab(n.id)}
                aria-current={tab === n.id ? 'page' : undefined}
                className={`flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium ${
                  tab === n.id ? 'bg-ink-800 text-white' : 'text-ink-200 hover:bg-ink-900'
                }`}
              >
                <Icon name={n.icon} />
                {n.label}
              </button>
            ))}
          </nav>
          {active.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400">Active projects</p>
              {active.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onOpenProject(p.id)}
                  aria-label={`Open project ${p.name}`}
                  className={`flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-left text-sm font-medium ${
                    selectedId === p.id ? 'bg-ink-800 text-white' : 'text-ink-200 hover:bg-ink-900'
                  }`}
                >
                  <span className="status-dot flex-none" style={{ backgroundColor: projectStatusMeta(p.status).color }} />
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </div>
          )}
          <div className="mt-auto flex flex-col gap-2">
            <button
              onClick={onAddPhoto}
              className="flex h-10 items-center justify-center gap-2 rounded-lg bg-signal-500 text-sm font-semibold text-ink-950 hover:bg-signal-400"
            >
              <Icon name="camera" /> Add photo
            </button>
            <p className="truncate px-1 text-xs text-ink-400">{email}</p>
            <button
              onClick={onSignOut}
              className="flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm text-ink-200 hover:bg-ink-900"
            >
              <Icon name="logout" size={16} /> Sign out
            </button>
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    )
  }

  const left = navItems.slice(0, isAdmin ? 2 : 1)
  const right = navItems.slice(left.length)
  const item = (n) => (
    <button
      key={n.id}
      onClick={() => onTab(n.id)}
      aria-current={tab === n.id ? 'page' : undefined}
      className={`flex min-h-[44px] min-w-[60px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
        tab === n.id ? 'text-ink-900' : 'text-ink-600'
      }`}
    >
      <Icon name={n.icon} size={22} />
      {n.label}
    </button>
  )
  return (
    <div className="min-h-screen bg-ink-50 pb-20">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between bg-ink-950 px-4">
        <Brand />
        <div className="flex items-center gap-1">
          <span className="max-w-[9rem] truncate text-xs text-ink-400">{email}</span>
          <button
            onClick={onSignOut}
            aria-label="Sign out"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-200 active:bg-ink-800"
          >
            <Icon name="logout" size={20} />
          </button>
        </div>
      </header>
      {children}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 flex h-[68px] items-center justify-around border-t border-ink-100 bg-white"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {left.map(item)}
        <button
          onClick={onAddPhoto}
          aria-label="Add photo"
          className="-mt-6 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-signal-500 text-ink-950 shadow-lg active:bg-signal-600"
        >
          <Icon name="plus" size={24} strokeWidth={2.4} />
        </button>
        {right.map(item)}
      </nav>
    </div>
  )
}
