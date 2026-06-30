import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Live Compete needs a Supabase project. Keys come from env (never hard-coded):
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
// See README "Live Compete setup" and supabase/migrations/0001_live_compete.sql.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** True only when both env vars are present, so the UI can degrade gracefully. */
export const isLiveConfigured = Boolean(url && anonKey)

// A single shared client (or null when unconfigured — callers guard on isLiveConfigured).
export const supabase: SupabaseClient | null = isLiveConfigured
  ? createClient(url as string, anonKey as string, {
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null

/** The public origin used to build the QR/join URL. */
export function appUrl(): string {
  const fromEnv = import.meta.env.VITE_APP_URL as string | undefined
  return (fromEnv || window.location.origin).replace(/\/$/, '')
}
