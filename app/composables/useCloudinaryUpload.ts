export function useCloudinaryUpload() {
  const config = useRuntimeConfig()

  const cloudinaryConfig = {
    cloud_name: config.public.cloudinaryCloudName,
    api_key: config.public.cloudinaryApiKey
  }

  const optimizeImage = async (file: File): Promise<File> => {
    if (!file.type.startsWith('image/')) throw new Error('Sélectionne un fichier image.')
    if (file.size > 5 * 1024 * 1024) throw new Error('L’image ne doit pas dépasser 5 Mo.')

    let bitmap: ImageBitmap
    try {
      bitmap = await createImageBitmap(file)
    } catch {
      return file
    }
    const maxDimension = 2000
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82))
    if (!blob) throw new Error('Impossible d’optimiser cette image.')
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' })
  }

  const uploadImage = async (file: File): Promise<{ url: string, public_id: string }> => {
    const formData = new FormData()
    formData.append('file', await optimizeImage(file))
    return await $fetch('/api/cloudinary/upload', { method: 'POST', body: formData })
  }

  const deleteAsset = async (public_id: string, resource_type: 'image' | 'video' = 'image'): Promise<void> => {
    try {
      // Server-side deletion requires API secret (use server endpoint instead)
      const response = await $fetch<{ success?: boolean }>('/api/cloudinary/delete', {
        method: 'POST',
        body: { public_id, resource_type }
      })

      if (!response?.success) {
        throw new Error('Failed to delete asset')
      }
    } catch (error) {
      console.error('Cloudinary delete error:', error)
      throw error
    }
  }

  const getImageUrl = (publicId: string, options?: Record<string, unknown>): string => {
    const baseUrl = `https://res.cloudinary.com/${cloudinaryConfig.cloud_name}/image/upload`
    const transformations = Object.entries(options || {})
      .map(([key, value]) => `${key}_${value}`)
      .join(',')

    return transformations ? `${baseUrl}/${transformations}/${publicId}` : `${baseUrl}/${publicId}`
  }

  return {
    uploadImage,
    deleteAsset,
    getImageUrl,
    config: cloudinaryConfig
  }
}
