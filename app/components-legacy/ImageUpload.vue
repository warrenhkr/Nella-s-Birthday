<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue?: string | null
  label?: string
  description?: string
  disabled?: boolean
}>(), {
  modelValue: null,
  label: 'Image',
  description: 'JPG, PNG ou WebP, 5 Mo maximum'
})

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  'uploaded': [value: { url: string, public_id: string }]
}>()

const { uploadImage, deleteAsset } = useCloudinaryUpload()
const file = ref<File | null>(null)
const pending = ref(false)
const errorMessage = ref('')
const publicId = ref<string | null>(null)

function publicIdFromUrl(url: string | null) {
  if (!url) return null
  const marker = '/upload/'
  const uploadIndex = url.indexOf(marker)
  if (uploadIndex < 0) return null
  const path = url.slice(uploadIndex + marker.length).split('?')[0] || ''
  const parts = path.split('/')
  const withoutVersion = parts[0]?.startsWith('v') && /^\d+$/.test(parts[0].slice(1)) ? parts.slice(1) : parts
  const value = withoutVersion.join('/')
  return value.replace(/\.[a-z0-9]+$/i, '') || null
}

async function upload(fileValue: File | File[] | null | undefined) {
  const selected = Array.isArray(fileValue) ? fileValue[0] : fileValue
  if (!selected) return
  pending.value = true
  errorMessage.value = ''
  const previousAssetId = publicId.value || publicIdFromUrl(props.modelValue)
  try {
    const uploaded = await uploadImage(selected)
    publicId.value = uploaded.public_id
    file.value = null
    emit('update:modelValue', uploaded.url)
    emit('uploaded', uploaded)
    if (previousAssetId && previousAssetId !== uploaded.public_id) {
      try {
        await deleteAsset(previousAssetId)
      } catch (error) {
        console.error('Cloudinary previous asset deletion error:', error)
      }
    }
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossible d’envoyer cette image.'
    file.value = null
  } finally {
    pending.value = false
  }
}

async function removeImage() {
  const assetId = publicId.value || publicIdFromUrl(props.modelValue)
  publicId.value = null
  emit('update:modelValue', null)
  file.value = null
  if (assetId) {
    try {
      await deleteAsset(assetId)
    } catch (error) {
      console.error('Cloudinary asset deletion error:', error)
    }
  }
}
</script>

<template>
  <div class="space-y-2">
    <UFileUpload
      v-model="file"
      accept="image/*"
      :label="label"
      :description="description"
      :disabled="disabled || pending"
      class="w-full"
      @update:model-value="upload"
    />
    <div
      v-if="modelValue"
      class="flex items-center gap-3 rounded-lg border border-default p-2"
    >
      <img
        :src="modelValue"
        :alt="label"
        class="h-16 w-16 rounded object-cover"
      >
      <UButton
        type="button"
        color="error"
        variant="soft"
        icon="i-lucide-trash-2"
        label="Supprimer"
        :disabled="pending"
        @click="removeImage"
      />
    </div>
    <p
      v-if="errorMessage"
      class="text-sm text-red-500"
    >
      {{ errorMessage }}
    </p>
  </div>
</template>
