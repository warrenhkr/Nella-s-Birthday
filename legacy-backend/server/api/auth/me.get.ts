import { getUser, getUserProfile } from '../../utils/auth'
import { primaryPoleOf, resolveUserPoles } from '#shared/poles'

export default defineEventHandler(async (event) => {
  const user = await getUser(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Session absente ou expirée'
    })
  }

  return {
    status: 200,
    data: {
      user: {
        id: user.id,
        email: user.email,
        pseudo: user.pseudo,
        role: user.role,
        // Périmètres d'administration (voir shared/admin-scopes.ts) : liste
        // vide = administrateur complet (compatibilité ascendante). Sert aux
        // middlewares de pages, à la navigation et aux écrans d'administration.
        adminScopes: user.adminScopes ?? [],
        pole: primaryPoleOf(user),
        poles: resolveUserPoles(user),
        nom: user.nom,
        prenom: user.prenom,
        telephone: user.telephone,
        situation: user.situation,
        pays: user.pays,
        profession: user.profession,
        universite: user.universite,
        faculte: user.faculte,
        filiere: user.filiere
      },
      profile: await getUserProfile(event)
    }
  }
})
