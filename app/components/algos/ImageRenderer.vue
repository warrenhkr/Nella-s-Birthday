<script setup lang="ts">
const props = defineProps<{ result?: Record<string, unknown> | null }>()

const imageSource = computed(() => {
  const payload = props.result ?? {}
  const source = typeof payload.data === 'string' ? payload.data
    : typeof payload.image === 'string' ? payload.image : ''
  return source || ''
})
</script>

<template>
  <div class="flex min-h-[360px] items-center justify-center rounded-[24px] bg-[#120b1d] p-3 shadow-[0_0_32px_rgba(255,110,168,0.12)]">
    <img v-if="imageSource" :src="imageSource" :alt="String(result?.title ?? 'Visualisation calculée par l’algorithme')" class="max-h-[360px] w-full rounded-2xl object-contain" />
    <div v-else class="flex h-[300px] w-full items-center justify-center rounded-2xl border border-dashed border-pink-200/25 text-sm uppercase tracking-[0.2em] text-pink-100/60">
      Image prête
    </div>
  </div>
</template>
