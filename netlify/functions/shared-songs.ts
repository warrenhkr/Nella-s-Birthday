import { neon } from '@neondatabase/serverless'

type SpotifyPreview = {
  title?: string
  author_name?: string
  thumbnail_url?: string
}

function isSpotifyPreview(value: unknown): value is SpotifyPreview {
  return typeof value === 'object'
    && value !== null
    && (!('title' in value) || typeof value.title === 'string')
    && (!('author_name' in value) || typeof value.author_name === 'string')
    && (!('thumbnail_url' in value) || typeof value.thumbnail_url === 'string')
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  })
}

function getSql() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) return null
  return neon(databaseUrl)
}

function isTrackRow(value: unknown): value is {
  spotifyId: string
  title: string
  artist: string
  cover: string
} {
  return typeof value === 'object'
    && value !== null
    && 'spotifyId' in value
    && typeof value.spotifyId === 'string'
    && 'title' in value
    && typeof value.title === 'string'
    && 'artist' in value
    && typeof value.artist === 'string'
    && 'cover' in value
    && typeof value.cover === 'string'
}

export default async function handler(request: Request) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return respond({ statusMessage: 'Méthode non autorisée.' }, 405)
  }

  const sql = getSql()
  if (!sql) {
    return respond({
      statusMessage: 'Le stockage partagé n’est pas configuré : ajoute DATABASE_URL dans les variables d’environnement Netlify.'
    }, 503)
  }

  try {
    if (request.method === 'GET') {
      const tracks = await sql`
        SELECT
          spotify_id AS "spotifyId",
          title,
          artist,
          cover_url AS cover
        FROM shared_songs
        ORDER BY created_at DESC
      `
      return respond({ tracks })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return respond({ statusMessage: 'Le lien envoyé est invalide.' }, 400)
    }

    if (typeof body !== 'object' || body === null || !('url' in body) || typeof body.url !== 'string') {
      return respond({ statusMessage: 'Colle un lien Spotify valide.' }, 400)
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(body.url)
    } catch {
      return respond({ statusMessage: 'Colle un lien Spotify valide.' }, 400)
    }

    const match = parsedUrl.protocol === 'https:'
      && parsedUrl.hostname === 'open.spotify.com'
      ? parsedUrl.pathname.match(/^\/track\/([a-zA-Z0-9]{22})\/?$/)
      : null
    if (!match) {
      return respond({ statusMessage: 'Utilise un lien Spotify vers une chanson.' }, 400)
    }

    const spotifyId = match[1]
    const canonicalUrl = `https://open.spotify.com/track/${spotifyId}`

    let previewResponse: Response
    try {
      previewResponse = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(canonicalUrl)}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(8000)
      })
    } catch (error) {
      console.error('[shared-songs] Spotify metadata request failed:', error)
      return respond({ statusMessage: 'Spotify ne répond pas pour le moment. Réessaie plus tard.' }, 502)
    }

    if (!previewResponse.ok) {
      return respond({ statusMessage: 'Spotify ne reconnaît pas ce lien de chanson.' }, 400)
    }

    const previewBody: unknown = await previewResponse.json()
    if (!isSpotifyPreview(previewBody) || !previewBody.title || !previewBody.thumbnail_url) {
      return respond({ statusMessage: 'Spotify n’a pas fourni les informations de cette chanson.' }, 502)
    }
    const preview = previewBody

    let coverUrl: URL
    try {
      coverUrl = new URL(preview.thumbnail_url)
    } catch {
      return respond({ statusMessage: 'Spotify a fourni une pochette invalide.' }, 502)
    }

    if (coverUrl.protocol !== 'https:' || !coverUrl.hostname.endsWith('.spotifycdn.com')) {
      return respond({ statusMessage: 'Spotify a fourni une pochette invalide.' }, 502)
    }

    const inserted = await sql`
      INSERT INTO shared_songs (spotify_id, title, artist, cover_url)
      VALUES (${spotifyId}, ${preview.title}, ${preview.author_name ?? ''}, ${coverUrl.toString()})
      ON CONFLICT (spotify_id) DO NOTHING
      RETURNING
        spotify_id AS "spotifyId",
        title,
        artist,
        cover_url AS cover
    `

    if (inserted[0] && isTrackRow(inserted[0])) {
      return respond({ track: inserted[0], alreadyExists: false }, 201)
    }

    const existing = await sql`
      SELECT
        spotify_id AS "spotifyId",
        title,
        artist,
        cover_url AS cover
      FROM shared_songs
      WHERE spotify_id = ${spotifyId}
      LIMIT 1
    `

    if (!existing[0] || !isTrackRow(existing[0])) {
      console.error('[shared-songs] Insert conflict without an existing track:', spotifyId)
      return respond({ statusMessage: 'La chanson n’a pas pu être enregistrée.' }, 500)
    }

    return respond({ track: existing[0], alreadyExists: true })
  } catch (error) {
    console.error('[shared-songs] Database operation failed:', error)
    if (
      typeof error === 'object'
      && error !== null
      && 'code' in error
      && error.code === '42P01'
    ) {
      return respond({
        statusMessage: 'La table du stockage partagé manque dans la base Neon. Applique netlify/migrations/001_shared_songs.sql puis réessaie.'
      }, 503)
    }
    return respond({ statusMessage: 'Le service des chansons est momentanément indisponible.' }, 500)
  }
}
