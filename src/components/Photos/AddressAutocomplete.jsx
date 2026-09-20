import { useEffect, useRef, useState } from 'react'

// Nominatim is OpenStreetMap's free geocoding search — no API key needed,
// which fits a free-tier project. It's rate-limited and meant for light use;
// see README.md for what to switch to if this app ever needs heavier volume.
async function searchAddress(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=0&limit=5&q=${encodeURIComponent(
    query
  )}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Address search failed')
  return res.json()
}

export default function AddressAutocomplete({ value, onChange, onSelect }) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleInput(e) {
    const text = e.target.value
    onChange(text)

    clearTimeout(debounceRef.current)
    if (text.trim().length < 3) {
      setSuggestions([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const results = await searchAddress(text)
        setSuggestions(results)
        setOpen(true)
      } catch {
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 400)
  }

  function pick(result) {
    onSelect({ address: result.display_name, lat: parseFloat(result.lat), lng: parseFloat(result.lon) })
    setSuggestions([])
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        value={value}
        onChange={handleInput}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder="Start typing an address…"
        className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-base focus:border-signal-500"
      />
      {loading && <p className="mt-1 text-xs text-ink-400">Searching…</p>}

      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-ink-200 bg-white shadow-lg">
          {suggestions.map((s) => (
            <li key={s.place_id}>
              <button
                type="button"
                onClick={() => pick(s)}
                className="block w-full px-3 py-2 text-left text-sm text-ink-800 hover:bg-ink-50"
              >
                {s.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
