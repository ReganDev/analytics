import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example).')
}

// Implicit flow on purpose: invite and reset links are opened on the client's
// own device, so the PKCE verifier (stored in whoever *sent* the invite's
// browser) would never be there and the link would fail.
export const supabase = createClient(url, anonKey, { auth: { flowType: 'implicit' } })

/** Postgres raises friendly messages from publish_post(); surface them as-is. */
export function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message)
  return 'Something went wrong. Please try again.'
}
