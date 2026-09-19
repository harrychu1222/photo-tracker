import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Fails loudly in dev instead of a confusing blank screen.
  console.error(
    'Missing Supabase env vars. Copy .env.example to .env and fill in your project URL/anon key.'
  )
}

export const supabase = createClient(url, anonKey)
export const PHOTOS_BUCKET = 'photos'
