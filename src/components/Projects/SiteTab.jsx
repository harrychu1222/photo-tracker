import { useState } from 'react'
import { useWork } from '../../context/WorkContext'
import { groupLists, listProgress } from '../../lib/checklists'
import DiaryPanel from './DiaryPanel'
import ChecklistsPanel from './ChecklistsPanel'

// Site diary and compliance checklists for one project.
export default function SiteTab({ project }) {
  const { diaryByProject, checksByProject, siteError } = useWork()
  const [view, setView] = useState('diary')
  const lists = groupLists(checksByProject[project.id] || [])
  const open = lists.filter((l) => !listProgress(l.items).complete).length
  if (siteError) return <p className="text-sm text-status-blocked">{siteError}</p>
  const btn = (id, label) => (
    <button key={id} onClick={() => setView(id)} aria-pressed={view === id} className={`min-h-[44px] rounded-full border px-4 text-sm font-medium ${view === id ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white text-ink-800'}`}>{label}</button>
  )
  return (
    <div>
      <div className="mb-4 flex gap-2">
        {btn('diary', `Diary (${(diaryByProject[project.id] || []).length})`)}
        {btn('checklists', `Checklists${open ? ` (${open} open)` : ''}`)}
      </div>
      {view === 'diary' ? <DiaryPanel project={project} /> : <ChecklistsPanel project={project} />}
    </div>
  )
}
