// Supabase Edge Function "client-photos".
// The public client page sends its link secret; this returns short-lived addresses for the
// photos that link may see. It uses the service role only to (1) ask the database which
// photos are allowed for that secret and (2) sign those private files for one hour.
// A wrong, expired or switched-off link returns an empty list.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// admin: a Supabase client created with the service role key.
export async function handle(req, admin) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ photos: [] }, 405)
  let token
  try {
    token = (await req.json())?.token
  } catch {
    return json({ photos: [] }, 400)
  }
  if (typeof token !== 'string' || token.length < 30 || token.length > 200) return json({ photos: [] })
  const { data, error } = await admin.rpc('client_photo_paths', { p_token: token })
  if (error || !Array.isArray(data) || data.length === 0) return json({ photos: [] })
  const paths = data.slice(0, 300).map((r) => r.storage_path)
  const { data: signed, error: e2 } = await admin.storage.from('photos').createSignedUrls(paths, 3600)
  if (e2 || !Array.isArray(signed)) return json({ photos: [] })
  const byPath = new Map(signed.map((s) => [s.path, s.signedUrl]))
  return json({ photos: data.filter((r) => byPath.get(r.storage_path)).map((r) => ({ id: r.photo_id, url: byPath.get(r.storage_path) })) })
}

if (typeof Deno !== 'undefined') {
  const { createClient } = await import('npm:@supabase/supabase-js@2')
  const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
  Deno.serve((req) => handle(req, admin))
}
