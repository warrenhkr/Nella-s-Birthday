import { createHash } from 'node:crypto'
import { getUserProfile, requireAuth } from '../../utils/auth'

// Rôles qui gèrent du contenu (galerie, événements, produits) : ils peuvent
// supprimer les médias qu'ils administrent.
const CONTENT_MANAGER_ROLES = ['INTERMEDIATE_ADMIN', 'ADMIN', 'SHOP_MANAGER']

export default defineEventHandler(async (event) => {
  // AVANT : un simple membre connecté pouvait détruire N'IMPORTE QUELLE image
  // Cloudinary du club en connaissant son public_id. Désormais il faut soit
  // gérer du contenu, soit supprimer SA propre image (avatar du profil, ou
  // fichier dont le chemin contient son identifiant).
  const user = await requireAuth(event)
  const profile = await getUserProfile(event)
  const body = await readBody(event)
  const { public_id, resource_type = 'image' } = body

  if (!public_id || typeof public_id !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'public_id is required'
    })
  }

  const isContentManager = CONTENT_MANAGER_ROLES.includes(user.role)
  const ownsAsset = (typeof profile?.avatar === 'string' && profile.avatar.includes(public_id))
    || public_id.includes(user.id)

  if (!isContentManager && !ownsAsset) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden - tu ne peux supprimer que ta propre image de profil'
    })
  }

  const config = useRuntimeConfig()

  try {
    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${config.public.cloudinaryCloudName}/${resource_type}/destroy`

    const timestamp = Math.floor(Date.now() / 1000)
    const signature = createHash('sha1')
      .update(`public_id=${public_id}&timestamp=${timestamp}${config.cloudinaryApiSecret}`)
      .digest('hex')

    await $fetch(cloudinaryUrl, {
      method: 'POST',
      body: {
        public_id,
        timestamp,
        api_key: config.public.cloudinaryApiKey,
        signature
      }
    })

    return {
      status: 200,
      message: 'Asset deleted successfully',
      success: true
    }
  } catch (error) {
    console.error('Cloudinary delete error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete asset'
    })
  }
})
