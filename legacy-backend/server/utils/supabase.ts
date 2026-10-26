import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

export const envSchema = z.object({
  NUXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  NUXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().or(z.literal('')),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().or(z.literal(''))
})

export function getSupabaseAdmin() {
  const runtime = useRuntimeConfig()
  const url = runtime.public.supabaseUrl || ''
  const key = runtime.supabaseServiceRoleKey || ''

  if (!url || !key) {
    return null
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}

export function getSupabasePublic() {
  const runtime = useRuntimeConfig()
  const url = runtime.public.supabaseUrl || ''
  const key = runtime.public.supabaseAnonKey || ''

  if (!url || !key) {
    return null
  }

  return createClient(url, key)
}
