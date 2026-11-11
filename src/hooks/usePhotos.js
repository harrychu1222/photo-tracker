import { useCallback, useEffect, useState } from 'react'
import { supabase, PHOTOS_BUCKET } from '../supabaseClient'
import { getTakenAt } from '../lib/exif'
import { useOffline } from '../context/OfflineContext'
import { useUndo } from '../context/UndoContext'
import { isRetryLater } from '../lib/offline'

const SIGNED_URL_TTL = 60 * 60 // 1 hour, refreshed on every fetch

export function usePhotos(userId) {
  const { submit, syncedAt } = useOffline()
  const { notify } = useUndo()
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPhotos = useCallback(async () => {
    setLoading(true)
    setError(null)

    let { data, error } = await supabase
      .from('photos')
      .select('*')
      .order('taken_at', { ascending: false, nullsFirst: false })

    // If migration_3_taken_at.sql hasn't been run yet on this database, fall
    // back to the old ordering instead of leaving the gallery empty.
    if (error?.code === '42703') {
      ;({ data, error } = await supabase.from('photos').select('*').order('created_at', { ascending: false }))
      if (!error) {
        setError('Note: run supabase/migration_3_taken_at.sql to enable the Timeline view and taken-date sorting.')
      }
    }

    if (error) {
      setError(isRetryLater(error) ? 'You are offline, so the gallery cannot load. Photos you take are saved on this phone and upload when you are back online.' : error.message)
      setLoading(false)
      return
    }

    // Private bucket → each photo needs a short-lived signed URL to display.
    const withUrls = await Promise.all(
      data.map(async (photo) => {
        const { data: signed } = await supabase.storage
          .from(PHOTOS_BUCKET)
          .createSignedUrl(photo.storage_path, SIGNED_URL_TTL)
        return { ...photo, url: signed?.signedUrl ?? null }
      })
    )

    setPhotos(withUrls)
    setLoading(false)
  }, [])

  // Photos that were waiting have just been sent: show them in the gallery.
  useEffect(() => {
    if (syncedAt) fetchPhotos()
  }, [syncedAt, fetchPhotos])

  useEffect(() => {
    fetchPhotos()

    // Live-update the gallery when teammates add/edit/remove photos.
    const channel = supabase
      .channel('photos-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, fetchPhotos)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchPhotos])

  async function uploadPhotos({ files, projectId, roomId, taskId, location, room, category, status, quotingStatus, tags, notes, lat, lng, onProgress }) {
    if (!userId) throw new Error('Not signed in')

    const total = files.length
    let done = 0
    const failures = []

    let queued = 0
    for (const file of files) {
      try {
        const ext = file.name.split('.').pop()
        const path = `${userId}/${crypto.randomUUID()}.${ext}`
        const takenAt = await getTakenAt(file)

        const row = {
          user_id: userId,
          storage_path: path,
          project_id: projectId || null,
          room_id: roomId || null,
          task_id: taskId || null,
          location: location.trim(),
          room: room?.trim() || '',
          category: category.trim(),
          status,
          quoting_status: quotingStatus || null,
          tags,
          notes: notes?.trim() || null,
          lat: lat ?? null,
          lng: lng ?? null,
          taken_at: takenAt.toISOString()
        }
        // Sent now if there is signal, otherwise saved on the phone and sent later.
        const res = await submit('photo', { name: file.name, path, blob: file, photoId: crypto.randomUUID(), row }, { quiet: true })
        if (res.queued) queued += 1
      } catch (err) {
        failures.push({ file: file.name, message: err.message })
      } finally {
        done += 1
        onProgress?.(done, total)
      }
    }

    if (queued) notify?.(queued === 1 ? 'Photo saved on this phone. It will upload when you are back online.' : `${queued} photos saved on this phone. They will upload when you are back online.`)

    if (queued < total) await fetchPhotos()

    if (failures.length) {
      throw new Error(
        `${total - failures.length} of ${total} uploaded. Failed: ${failures.map((f) => f.file).join(', ')}`
      )
    }
  }

  async function updatePhoto(id, updates) {
    const { error } = await supabase.from('photos').update(updates).eq('id', id)
    if (error) throw error
    await fetchPhotos()
  }

  async function deletePhoto(photo) {
    await supabase.storage.from(PHOTOS_BUCKET).remove([photo.storage_path])
    const { error } = await supabase.from('photos').delete().eq('id', photo.id)
    if (error) throw error
    await fetchPhotos()
  }

  return { photos, loading, error, uploadPhotos, updatePhoto, deletePhoto, refresh: fetchPhotos }
}
