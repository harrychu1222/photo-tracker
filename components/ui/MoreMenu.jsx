import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

// A small button that opens a list of less-used actions. Closes on outside tap, Escape or choosing.
export default function MoreMenu({ items, label = 'More actions', icon = 'more', className = '', header = null }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const away = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', away)
    document.addEventListener('touchstart', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('touchstart', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={className || 'flex h-11 w-11 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-900'}
      >
        <Icon name={icon} size={20} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-1 min-w-[220px] max-w-[85vw] rounded-xl border border-ink-100 bg-white py-1 shadow-lg">
          {header}
          {items.filter(Boolean).map((i) => (
            <button
              key={i.label}
              role="menuitem"
              onClick={() => {
                setOpen(false)
                i.onClick()
              }}
              className={`flex min-h-[44px] w-full items-center gap-2.5 px-4 text-left text-sm font-medium hover:bg-ink-50 ${i.danger ? 'text-status-blocked' : 'text-ink-900'}`}
            >
              {i.icon && <Icon name={i.icon} size={18} />}
              {i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
