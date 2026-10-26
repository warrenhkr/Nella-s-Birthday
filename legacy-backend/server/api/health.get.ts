import prisma from '../utils/prisma'

function looksLikeSessionPooler(url: string) {
  return /pooler\.|\b6543\b/.test(url)
}

export default defineEventHandler(async () => {
  const runtime = useRuntimeConfig()
  const databaseUrl = process.env.DATABASE_URL || ''
  const supabaseUrl = runtime.public.supabaseUrl || process.env.NUXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = runtime.public.supabaseAnonKey || process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const hasDatabase = Boolean(databaseUrl)
  const hasPublicSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)

  let databaseStatus = 'missing'
  let databaseMessage = 'DATABASE_URL is not set.'

  if (hasDatabase) {
    databaseStatus = looksLikeSessionPooler(databaseUrl) ? 'ok' : 'warning'
    databaseMessage = looksLikeSessionPooler(databaseUrl)
      ? 'DATABASE_URL is configured with a Supabase Session Pooler URL.'
      : 'DATABASE_URL is using a direct connection string; prefer a Session Pooler URL in production.'
  }

  let dbCheck: { ok: boolean, message: string } = {
    ok: false,
    message: 'Database check not attempted.'
  }

  if (hasDatabase) {
    try {
      await prisma.$queryRaw`SELECT 1`
      dbCheck = { ok: true, message: 'Prisma connection successful.' }
    } catch (error) {
      dbCheck = {
        ok: false,
        message: error instanceof Error
          ? `Prisma connection failed: ${error.message}`
          : 'Prisma connection failed.'
      }
    }
  }

  // Réponse volontairement MINIMALE : la version précédente exposait publiquement
  // l'hôte et le port de la base, l'URL Supabase, la présence de la clé anon et
  // le message d'erreur brut de Prisma (fuite d'infrastructure exploitable pour
  // cibler le serveur). On ne renvoie plus que des booléens de santé.
  return {
    status: 200,
    data: {
      database: { configured: hasDatabase, status: databaseStatus },
      supabase: { configured: hasPublicSupabaseConfig },
      prisma: { ok: dbCheck.ok },
      checkedAt: new Date().toISOString()
    }
  }
})
