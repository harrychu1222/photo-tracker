import { createClient } from '@supabase/supabase-js'

// A separate, signed-out client for the public page, so it never uses (or touches) a login.
let client
export function clientViewer() {
  if (!client) {
    client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'site-log-client-view' }
    })
  }
  return client
}

export async function fetchClientView(token) {
  const { data, error } = await clientViewer().rpc('client_view', { p_token: token })
  if (error) throw new Error(error.message)
  return data // null when the link is wrong, expired or switched off
}

// Short-lived addresses for the photos this link may see, keyed by photo id (the server function
// checks the link itself; a wrong or switched-off link gets nothing).
export async function fetchClientPhotoUrls(token) {
  const { data, error } = await clientViewer().functions.invoke('client-photos', { body: { token } })
  if (error || !data?.photos) return {}
  return Object.fromEntries(data.photos.map((p) => [p.id, p.url]))
}
