import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { fmtDate } from '../../lib/format'
import { EXPIRY_OPTIONS, expiresAtFor, hashToken, linkState, linkUrl, newToken } from '../../lib/clientshare'

const OLD_COPIES_BUCKET = 'client-photos' // first version copied photos here; they are cleaned up on open
const inputClass = 'rounded-lg border border-ink-200 bg-white px-3 py-2 text-base focus:border-signal-500'
const MISSING = 'Client sharing is not set up yet. Run supabase/migration_23_client_link.sql in Supabase, then reload.'
const isMissing = (e) => e && (e.code === 'PGRST205' || e.code === '42P01')
const dayOf = (iso) => (iso ? String(iso).slice(0, 10) : '')

// Managers: switch the client progress link on or off and choose which photos the client sees.
export default function ClientShareDialog({ project, photos, tasks, onClose }) {
  const [links, setLinks] = useState([])
  const [choices, setChoices] = useState([]) // client_photo_choices rows
  const [picked, setPicked] = useState(new Set()) // photo ids the client will see
  const [expiry, setExpiry] = useState('7')
  const [fresh, setFresh] = useState(null) // the URL, shown once
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [note, setNote] = useState(null)
  const [ready, setReady] = useState(false)

  const taskOf = (photo) => tasks.find((t) => t.id === photo.task_id)
  // Without a manager's choice, a photo shows once its task is Done.
  const isDefault = (photo) => taskOf(photo)?.status === 'done'

  const load = useCallback(async () => {
    // The first version copied photos into a public folder. Remove any leftovers.
    const old = await supabase.from('client_shared_photos').select('*').eq('project_id', project.id)
    if (!old.error && old.data?.length) {
      await supabase.storage.from(OLD_COPIES_BUCKET).remove(old.data.map((r) => r.public_path))
      await supabase.from('client_shared_photos').delete().eq('project_id', project.id)
    }
    const [l, c] = await Promise.all([
      supabase.from('client_links').select('*').eq('project_id', project.id).order('created_at', { ascending: false }),
      supabase.from('client_photo_choices').select('*').eq('project_id', project.id)
    ])
    const err = l.error || c.error
    if (err) return setError(isMissing(err) ? MISSING : err.message)
    setLinks(l.data)
    setChoices(c.data)
    setPicked(new Set(photos.filter((p) => { const ch = c.data.find((x) => x.photo_id === p.id); return ch ? ch.share : isDefault(p) }).map((p) => p.id)))
    setReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  useEffect(() => {
    load()
  }, [load])

  const active = links.find((l) => linkState(l) === 'active')
  const choiceOf = (id) => choices.find((c) => c.photo_id === id)
  const effective = (p) => (choiceOf(p.id) ? choiceOf(p.id).share : isDefault(p))
  const changed = photos.some((p) => picked.has(p.id) !== effective(p))

  async function run(label, fn) {
    setBusy(label)
    setError(null)
    setNote(null)
    try {
      await fn()
    } catch (err) {
      setError(err.message || String(err))
    }
    setBusy(null)
  }

  async function revokeActive() {
    const { error: e } = await supabase.from('client_links').update({ revoked_at: new Date().toISOString() }).eq('project_id', project.id).is('revoked_at', null)
    if (e) throw new Error(e.message)
  }

  const createLink = () =>
    run('link', async () => {
      const token = newToken()
      await revokeActive() // one live link per project
      const { error: e } = await supabase.from('client_links').insert({ project_id: project.id, token_hash: await hashToken(token), expires_at: expiresAtFor(expiry) })
      if (e) throw new Error(isMissing(e) ? MISSING : e.message)
      setFresh(linkUrl(token, window.location.origin))
      setCopied(false)
      await load()
    })

  const turnOff = () =>
    run('off', async () => {
      await revokeActive()
      setFresh(null)
      setNote('The link is off. Anyone who opens it now sees "no longer active".')
      await load()
    })

  // Only differences from the default are stored; matching the default removes the choice.
  const savePhotos = () =>
    run('photos', async () => {
      const upserts = []
      const removes = []
      for (const p of photos) {
        const want = picked.has(p.id)
        if (want !== isDefault(p)) upserts.push({ project_id: project.id, photo_id: p.id, share: want })
        else if (choiceOf(p.id)) removes.push(p.id)
      }
      if (upserts.length) {
        const { error: e } = await supabase.from('client_photo_choices').upsert(upserts, { onConflict: 'project_id,photo_id' })
        if (e) throw new Error(isMissing(e) ? MISSING : e.message)
      }
      if (removes.length) {
        const { error: e } = await supabase.from('client_photo_choices').delete().eq('project_id', project.id).in('photo_id', removes)
        if (e) throw new Error(e.message)
      }
      setNote('Saved. The client page now shows the ticked photos.')
      await load()
    })

  const stopAll = () =>
    run('stop', async () => {
      await revokeActive()
      setFresh(null)
      setNote('Sharing stopped: the link is off.')
      await load()
    })

  async function copy() {
    try {
      await navigator.clipboard.writeText(fresh)
      setCopied(true)
    } catch {
      document.getElementById('cs-url')?.select()
    }
  }

  const toggle = (id) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-label="Share with client" data-testid="share-dialog">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 sm:max-w-lg sm:rounded-2xl">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-bold text-ink-900">Share progress with {project.name}'s client</h3>
          <button onClick={onClose} aria-label="Close" className="-mr-2 flex h-11 w-11 items-center justify-center text-2xl leading-none text-ink-400">×</button>
        </div>
        <p className="mb-3 text-sm text-ink-600">The client sees your schedule (tasks, rooms, dates, progress) and photos. Never money, notes, hours, defects or worker names. Anyone with the link can view it, so only send it to your client.</p>
        {error && <p className="mb-2 text-sm text-status-blocked" role="alert">{error}</p>}
        {note && <p className="mb-2 text-sm text-ink-800" role="status">{note}</p>}

        {ready && (
          <>
            <section className="mb-4 rounded-xl border border-ink-100 p-3" aria-label="Link">
              <h4 className="mb-1 text-sm font-semibold text-ink-900">Link</h4>
              {active ? (
                <p className="mb-2 text-sm text-ink-800" data-testid="link-status">On · {active.expires_at ? `expires ${fmtDate(dayOf(active.expires_at))}` : 'no expiry'} · {active.last_viewed_at ? `last viewed ${fmtDate(dayOf(active.last_viewed_at))}` : 'not opened yet'}</p>
              ) : (
                <p className="mb-2 text-sm text-ink-600" data-testid="link-status">Off. Nobody can open a link for this project.</p>
              )}
              {fresh && (
                <div className="mb-2 rounded-lg bg-ink-50 p-2">
                  <p className="mb-1 text-xs text-ink-600">Copy it now. For security the link can't be shown again; make a new one if you lose it.</p>
                  <input id="cs-url" readOnly value={fresh} aria-label="Client link" onFocus={(e) => e.target.select()} className={`${inputClass} w-full text-sm`} />
                  <div className="mt-2 flex gap-2">
                    <button onClick={copy} className="min-h-[44px] rounded-lg bg-ink-900 px-4 text-sm font-semibold text-white">{copied ? 'Copied' : 'Copy link'}</button>
                    <a href={fresh} target="_blank" rel="noreferrer" className="flex min-h-[44px] items-center rounded-lg border border-ink-200 px-4 text-sm font-semibold text-ink-900">Open preview</a>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm text-ink-800" htmlFor="cs-exp">Expires after</label>
                <select id="cs-exp" value={expiry} onChange={(e) => setExpiry(e.target.value)} aria-label="Expires after" className={inputClass}>
                  {EXPIRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <button disabled={busy === 'link'} onClick={createLink} className="min-h-[44px] rounded-lg bg-signal-500 px-4 text-sm font-semibold text-ink-950 disabled:opacity-60">{active ? 'Make a new link' : 'Create link'}</button>
                {active && <button disabled={busy === 'off'} onClick={() => confirm('Turn the link off? The client will no longer be able to open it.') && turnOff()} className="min-h-[44px] rounded-lg border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-900">Turn off link</button>}
              </div>
              {active && <p className="mt-2 text-xs text-ink-600">"Make a new link" replaces the old one, which stops working.</p>}
            </section>

            <section className="mb-4 rounded-xl border border-ink-100 p-3" aria-label="Photos">
              <h4 className="mb-1 text-sm font-semibold text-ink-900">Photos the client can see ({photos.filter(effective).length} now)</h4>
              <p className="mb-2 text-xs text-ink-600">Photos linked to a task appear under that task once the task is Done. Untick a photo to hide it, or tick any other photo to show it.</p>
              {photos.length === 0 ? (
                <p className="text-sm text-ink-600">No photos are linked to this project yet.</p>
              ) : (
                <>
                  <div className="mb-2 flex gap-3 text-sm">
                    <button onClick={() => setPicked(new Set(photos.map((p) => p.id)))} className="min-h-[44px] font-medium text-ink-600 underline">Select all</button>
                    <button onClick={() => setPicked(new Set())} className="min-h-[44px] font-medium text-ink-600 underline">Select none</button>
                    <button onClick={() => setPicked(new Set(photos.filter(isDefault).map((p) => p.id)))} className="min-h-[44px] font-medium text-ink-600 underline">Completed tasks only</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {photos.map((p, i) => {
                      const t = taskOf(p)
                      return (
                        <label key={p.id} className={`relative block overflow-hidden rounded-lg border-2 ${picked.has(p.id) ? 'border-signal-500' : 'border-ink-100'}`}>
                          {p.url ? <img src={p.url} alt="" className="aspect-square w-full object-cover" /> : <span className="block aspect-square bg-ink-100" />}
                          <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Share photo ${i + 1}`} className="absolute left-1.5 top-1.5 h-5 w-5" />
                          <span className="block truncate px-1.5 py-1 text-xs text-ink-600">{t ? `${t.name}${t.status === 'done' ? ' ✓' : ''}` : 'No task'}</span>
                        </label>
                      )
                    })}
                  </div>
                  <button disabled={!changed || busy === 'photos'} onClick={savePhotos} className="mt-3 min-h-[44px] rounded-lg bg-signal-500 px-4 text-sm font-semibold text-ink-950 disabled:opacity-50">Save photo choices</button>
                </>
              )}
            </section>

            <button disabled={busy === 'stop' || !active} onClick={() => confirm('Stop all sharing? The link turns off.') && stopAll()} className="min-h-[44px] rounded-lg border border-[#C0503E] px-4 text-sm font-semibold text-[#7A2A1D] disabled:opacity-40">Stop all sharing</button>
          </>
        )}
        <div className="mt-3"><button onClick={onClose} className="min-h-[44px] rounded-lg border border-ink-200 bg-white px-5 text-sm font-semibold text-ink-900">Close</button></div>
      </div>
    </div>
  )
}
