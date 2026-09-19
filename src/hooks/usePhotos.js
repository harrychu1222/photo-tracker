import { useCallback, useEffect, useState } from 'react'
import { supabase, PHOTOS_BUCKET } from '../supabaseClient'

const SIGNED_URL_TTL = 60 * 60 // 1 hour, refreshed on every fetch

export function usePhotos(userId) {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPhotos = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
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

  useEffect(() => {
    fetchPhotos()

    // Live-update the gallery when teammates add/edit/remove photos.
    const channel = supabase
      .channel('photos-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, fetchPhotos)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchPhotos])

  async function uploadPhoto({ file, location, category, status, tags, notes }) {
    if (!userId) throw new Error('Not signed in')

    const ext = file.name.split('.').pop()
    const path = `${userId}/${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage.from(PHOTOS_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false
    })
    if (uploadError) throw uploadError

    const { error: insertError } = await supabase.from('photos').insert({
      user_id: userId,
      storage_path: path,
      location: location.trim(),
      category: category.trim(),
      status,
      tags,
      notes: notes?.trim() || null
    })
    if (insertError) throw insertError

    await fetchPhotos()
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

  return { photos, loading, error, uploadPhoto, updatePhoto, deletePhoto, refresh: fetchPhotos }
}
