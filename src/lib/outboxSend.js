import { PHOTOS_BUCKET } from '../supabaseClient'
import { isRetryLater } from './offline'

// Sends one saved item. Safe to run twice: each item carries its own ids, and "already there"
// answers count as success, so a retry after a half-finished send never duplicates anything.
// Throws an Error; err.retryLater is true when the cause is no signal / expired login.

const DUPLICATE = '23505'
const isDuplicate = (err) => err?.code === DUPLICATE
const isMissingColumn = (err) => err?.code === '42703' || err?.code === 'PGRST204'
const alreadyThere = (err) => Number(err?.statusCode) === 409 || /already exists|duplicate/i.test(String(err?.message || ''))

function fail(err) {
  const e = new Error(err?.message || String(err))
  e.retryLater = isRetryLater(err)
  e.code = err?.code
  throw e
}

export async function insertPhotoRow(supabase, payload) {
  let { error } = await supabase.from('photos').insert(payload)
  // A column isn't migrated yet: retry without the newest columns rather than failing.
  if (isMissingColumn(error)) {
    const { room_id, task_id, ...withoutStage2 } = payload
    ;({ error } = await supabase.from('photos').insert(withoutStage2))
    if (isMissingColumn(error)) {
      const { taken_at, project_id, ...legacy } = withoutStage2
      ;({ error } = await supabase.from('photos').insert(legacy))
    }
  }
  if (error && !isDuplicate(error)) fail(error)
}

export async function sendItem(supabase, item) {
  const p = item.payload
  switch (item.kind) {
    case 'photo': {
      const { error } = await supabase.storage.from(PHOTOS_BUCKET).upload(p.path, p.blob, { cacheControl: '3600', upsert: false })
      if (error && !alreadyThere(error)) fail(error)
      await insertPhotoRow(supabase, { id: p.photoId, ...p.row })
      return
    }
    case 'diary_add': {
      const { error } = await supabase.from('diary_entries').insert({ ...p.fields, id: p.entryId, project_id: p.projectId, created_by: p.userId })
      if (error && !isDuplicate(error)) fail(error)
      if (p.issues?.length) {
        const rows = p.issues.map((i) => ({ id: i.id, entry_id: p.entryId, project_id: p.projectId, text: i.text, created_by: p.userId }))
        const { error: e2 } = await supabase.from('diary_issues').insert(rows)
        if (e2 && !isDuplicate(e2)) fail(e2)
      }
      return
    }
    case 'check_done': {
      const { error } = await supabase.from('compliance_items').update(p.patch).eq('id', p.id)
      if (error) fail(error)
      return
    }
    default:
      throw new Error(`Unknown saved item: ${item.kind}`)
  }
}

// What the person sees for a saved item.
export function describeItem(item) {
  const p = item.payload
  switch (item.kind) {
    case 'photo':
      return { label: 'Photo', detail: p.name || '' }
    case 'diary_add':
      return { label: 'Diary entry', detail: p.fields?.work_done || (p.issues?.[0]?.text ?? '') }
    case 'check_done':
      return { label: 'Checklist', detail: p.patch?.done === false ? 'Un-ticked an item' : p.patch?.done ? 'Ticked an item' : 'Updated a note' }
    default:
      return { label: item.kind, detail: '' }
  }
}
