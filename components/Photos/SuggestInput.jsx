import { useEffect, useRef, useState } from 'react'

export default function SuggestInput({ value, onChange, options = [], placeholder }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const matches =
    value.trim().length > 0
      ? options.filter((o) => o.toLowerCase().includes(value.trim().toLowerCase()) && o.toLowerCase() !== value.trim().toLowerCase())
      : options

  return (
    <div ref={containerRef} className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-base focus:border-signal-500"
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-ink-200 bg-white shadow-lg">
          {matches.slice(0, 6).map((m) => (
            <li key={m}>
              <button
                type="button"
                onClick={() => {
                  onChange(m)
                  setOpen(false)
                }}
                className="block w-full px-3 py-2 text-left text-sm text-ink-800 hover:bg-ink-50"
              >
                {m}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
