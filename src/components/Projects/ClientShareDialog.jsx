import { useCallback, useEffect, useState } from 'react'
import { supabase, PHOTOS_BUCKET } from '../../supabaseClient'
import { fmtDate } from '../../lib/format'
import { EXPIRY_OPTIONS, expiresAtFor, hashToken, linkState, linkUrl, newToken } from '../../lib/clientshare'

const CLIENT_BUCKET = 'client-photos'
const inputClass = 'rounded-lg border border-ink-200 bg-white px-3 py-2 text-base focus:border-signal-500'
const MISSING = 'Client sharing is not set up yet. Run supabase/migration_23_client_link.sql in Supabase, then reload.'
const isMissing = (e) => e && (e.code === 'PGRST205' || e.code === '42P01')
const dayOf = (iso) => (iso ? String(iso).slice(0, 10) : '')

// Managers: switch the client progress link on or off and choose which photos the client sees.
export default function ClientShareDialog({ project, photos, onClose }) {
  const [links, setLinks] = useState([])
  const [shared, setShared] = useState([]) // client_shared_photos rows
  const [picked, setPicked] = useState(new Set())
  const [expiry, setExpiry] = useState('90')
  const [fresh, setFresh] = useState(null) // the URL, shown once
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [note, setNote] = useState(null)
  const [ready, setReady] = useState(false)

  const load = useCallback(async () => {
    const [l, s] = await Promise.all([
      supabase.from('client_links').select('*').eq('project_id', project.id).order('created_at', { ascending: false }),
      supabase.from('client_shared_photos').select('*').eq('project_id', project.id)
    ])
    const err = l.error || s.error
    if (err) return setError(isMissing(err) ? MISSING : err.message)
    setLinks(l.data)
    setShared(s.data)
    setPicked(new Set(s.data.map((r) => r.photo_id)))
    setReady(true)
  }, [project.id])

  useEffect(() => {
    load()
  }, [load])

  const active = links.find((l) => linkState(l) === 'active')
  const sharedIds = new Set(shared.map((r) => r.photo_id))
  const toAdd = photos.filter((p) => picked.has(p.id) && !sharedIds.has(p.id))
  const toRemove = shared.filter((r) => !picked.has(r.photo_id))
  const changed = toAdd.length + toRemove.length > 0

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

  const updatePhotos = () =>
    run('photos', async () => {
      let n = 0
      for (const p of toAdd) {
        n += 1
        setNote(`Copying photo ${n} of ${toAdd.length}…`)
        const { data: blob, error: de } = await supabase.storage.from(PHOTOS_BUCKET).download(p.storage_path)
        if (de || !blob) throw new Error('Could not read one of the photos.')
        const ext = (p.storage_path.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
        const path = `${project.id}/${crypto.randomUUID()}.${ext}`
        const { error: ue } = await supabase.storage.from(CLIENT_BUCKET).upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false })
        if (ue) throw new Error(ue.message)
        const { error: ie } = await supabase.from('client_shared_photos').insert({ project_id: project.id, photo_id: p.id, public_path: path })
        if (ie) {
          await supabase.storage.from(CLIENT_BUCKET).remove([path])
          throw new Error(isMissing(ie) ? MISSING : ie.message)
        }
      }
      if (toRemove.length) {
        await supabase.storage.from(CLIENT_BUCKET).remove(toRemove.map((r) => r.public_path))
        const { error: re } = await supabase.from('client_shared_photos').delete().eq('project_id', project.id).in('photo_id', toRemove.map((r) => r.photo_id))
        if (re) throw new Error(re.message)
      }
      setNote(`Done. ${picked.size} photo${picked.size === 1 ? '' : 's'} visible to the client.`)
      await load()
    })

  const stopAll = () =>
    run('stop', async () => {
      if (shared.length) {
        await supabase.storage.from(CLIENT_BUCKET).remove(shared.map((r) => r.public_path))
        const { error: re } = await supabase.from('client_shared_photos').delete().eq('project_id', project.id)
        if (re) throw new Error(re.message)
      }
      await revokeActive()
      setFresh(null)
      setNote('Sharing stopped: the link is off and the shared photo copies are deleted.')
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
          <button onClick={onClose} aria-label="Close" className="text-2xl leading-none text-ink-400">×</button>
        </div>
        <p className="mb-3 text-sm text-ink-600">The client sees your schedule (tasks, rooms, dates, progress) and the photos you tick below. Never money, notes, hours, defects or worker names. Anyone with the link can view it, so only send it to your client.</p>
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
              <h4 className="mb-1 text-sm font-semibold text-ink-900">Photos the client can see ({sharedIds.size} shared)</h4>
              {photos.length === 0 ? (
                <p className="text-sm text-ink-600">No photos are linked to this project yet.</p>
              ) : (
                <>
                  <div className="mb-2 flex gap-3 text-sm">
                    <button onClick={() => setPicked(new Set(photos.map((p) => p.id)))} className="min-h-[40px] font-medium text-ink-600 underline">Select all</button>
                    <button onClick={() => setPicked(new Set())} className="min-h-[40px] font-medium text-ink-600 underline">Select none</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {photos.map((p, i) => (
                      <label key={p.id} className={`relative block overflow-hidden rounded-lg border-2 ${picked.has(p.id) ? 'border-signal-500' : 'border-ink-100'}`}>
                        {p.url ? <img src={p.url} alt="" className="aspect-square w-full object-cover" /> : <span className="block aspect-square bg-ink-100" />}
                        <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Share photo ${i + 1}`} className="absolute left-1.5 top-1.5 h-5 w-5" />
                      </label>
                    ))}
                  </div>
                  <button disabled={!changed || busy === 'photos'} onClick={updatePhotos} className="mt-3 min-h-[44px] rounded-lg bg-signal-500 px-4 text-sm font-semibold text-ink-950 disabled:opacity-50">
                    {changed ? `Update shared photos (${toAdd.length ? `+${toAdd.length}` : ''}${toAdd.length && toRemove.length ? ' ' : ''}${toRemove.length ? `−${toRemove.length}` : ''})` : 'Update shared photos'}
                  </button>
                  <p className="mt-1 text-xs text-ink-600">Ticked photos are copied to a separate public folder under random names. Unticking deletes the copy.</p>
                </>
              )}
            </section>

            <button disabled={busy === 'stop' || (!active && !shared.length)} onClick={() => confirm('Stop all sharing? The link turns off and every shared photo copy is deleted.') && stopAll()} className="min-h-[44px] rounded-lg border border-[#C0503E] px-4 text-sm font-semibold text-[#7A2A1D] disabled:opacity-40">Stop all sharing</button>
          </>
        )}
        <div className="mt-3"><button onClick={onClose} className="min-h-[44px] rounded-lg border border-ink-200 bg-white px-5 text-sm font-semibold text-ink-900">Close</button></div>
      </div>
    </div>
  )
}
