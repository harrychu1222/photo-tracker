import { useState } from 'react'

export default function TagInput({ tags, onChange, placeholder = 'Add a tag and press Enter' }) {
  const [draft, setDraft] = useState('')

  function commit() {
    const clean = draft.trim()
    if (clean && !tags.includes(clean)) onChange([...tags, clean])
    setDraft('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Backspace' && !draft && tags.length) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-200 px-2 py-2 focus-within:border-signal-500">
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-800"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            className="text-ink-400 hover:text-ink-800"
            aria-label={`Remove tag ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        placeholder={tags.length ? '' : placeholder}
        className="min-w-[8rem] flex-1 border-none px-1 py-1 text-sm outline-none"
      />
    </div>
  )
}
