import { clearOtakuSession, revokeSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  await revokeSession(event)
  clearOtakuSession(event)

  return {
    status: 200,
    message: 'Déconnexion réussie'
  }
})
