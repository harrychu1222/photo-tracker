import { useAuth } from '../../context/AuthContext'

export default function Header({ onAddPhoto }) {
  const { user, signOut } = useAuth()

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-100 bg-ink-50/95 px-4 py-3 backdrop-blur">
      <div>
        <h1 className="text-lg font-semibold text-ink-900">Site Log</h1>
        <p className="truncate text-xs text-ink-600">{user?.email}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onAddPhoto}
          className="rounded-full bg-signal-500 px-4 py-2 text-sm font-medium text-white active:bg-signal-600"
        >
          + Add photo
        </button>
        <button
          onClick={signOut}
          className="rounded-full border border-ink-200 px-3 py-2 text-sm text-ink-600 active:bg-ink-100"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
