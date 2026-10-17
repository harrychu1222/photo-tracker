const TABS = [
  {
    id: 'photos',
    label: 'Photos',
    icon: (
      <path
        d="M4 8a2 2 0 0 1 2-2h1.5l1-1.5h5l1 1.5H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8zm8 8.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    )
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: (
      <path
        d="M4 7a2 2 0 0 1 2-2h3.5l2 2H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    )
  }
]

export default function TabBar({ tab, onChange, widthClass }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 border-t border-ink-100 bg-white/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Main"
    >
      <div className={`mx-auto flex ${widthClass}`}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            className={`flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              tab === t.id ? 'text-signal-600' : 'text-ink-400'
            }`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              {t.icon}
            </svg>
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
