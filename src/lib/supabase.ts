import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** False when the Vite env variables were not provided at build time. */
export const isSupabaseConfigured = Boolean(url && anonKey)

// Row shapes are typed in src/types/database.ts and applied in the service
// layer (src/services/*), which is the only place that talks to Supabase.
// Only the public anon key is ever used in the browser. The service-role key
// must never be added to this project. A harmless placeholder is used when the
// variables are missing so the app can render a friendly setup message.
export const supabase = createClient(
  url || 'https://project-not-configured.supabase.co',
  anonKey || 'public-anon-key-not-configured',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
)

export const WEDDING_ASSETS_BUCKET = 'wedding-assets'
