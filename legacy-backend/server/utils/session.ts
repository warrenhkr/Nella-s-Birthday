import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import prisma from './prisma'

const SESSION_COOKIE = 'otaku_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30

function getSessionSecret() {
  const secret = process.env.NUXT_SESSION_SECRET
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('NUXT_SESSION_SECRET is required in production to sign sessions')
  }

  if (!secret) return process.env.DATABASE_URL || 'development-only-session-secret'
  return secret
}

function sign(payload: string) {
  return createHmac('sha256', getSessionSecret()).update(payload).digest('base64url')
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(userId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  const tokenId = randomBytes(24).toString('base64url')
  const payload = `${userId}.${expiresAt}.${tokenId}`
  const token = `${payload}.${sign(payload)}`

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(expiresAt * 1000)
    }
  })

  return token
}

export async function readSession(event: Parameters<typeof getCookie>[0]) {
  const token = getCookie(event, SESSION_COOKIE)
  if (!token) return null

  const [userId, expiresAtValue, tokenId, signature] = token.split('.')
  const expiresAt = Number(expiresAtValue)
  if (!userId || !Number.isFinite(expiresAt) || !tokenId || !signature || expiresAt < Math.floor(Date.now() / 1000)) return null

  const payload = `${userId}.${expiresAt}.${tokenId}`
  const expectedSignature = sign(payload)
  const provided = Buffer.from(signature)
  const expected = Buffer.from(expectedSignature)

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null

  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } })
  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now() || session.userId !== userId) return null

  return userId
}

export async function setSession(event: Parameters<typeof setCookie>[0], userId: string) {
  setCookie(event, SESSION_COOKIE, await createSession(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_SECONDS,
    path: '/'
  })
}

export function clearOtakuSession(event: Parameters<typeof setCookie>[0]) {
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}

export async function revokeSession(event: Parameters<typeof getCookie>[0]) {
  const token = getCookie(event, SESSION_COOKIE)
  if (!token) return

  await prisma.session.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() }
  })
}
