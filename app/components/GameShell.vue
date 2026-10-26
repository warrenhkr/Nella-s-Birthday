<script setup lang="ts">
const props = defineProps<{
  title: string
  subtitle?: string
  score?: number
  showScore?: boolean
}>()

const emit = defineEmits<{
  (event: 'replay'): void
  (event: 'back'): void
}>()
</script>

<template>
  <div class="mx-auto max-w-5xl rounded-[32px] border border-pink-200/15 bg-white/5 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.24)] backdrop-blur-sm sm:p-6">
    <header class="mb-5 flex flex-col gap-4 border-b border-pink-200/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-[10px] uppercase tracking-[0.32em] text-pink-200/80">Mini-jeux</p>
        <h1 class="mt-2 text-2xl font-semibold text-pink-100 sm:text-3xl">{{ props.title }}</h1>
        <p v-if="props.subtitle" class="mt-1 text-sm text-pink-50/80">{{ props.subtitle }}</p>
      </div>

      <div class="flex items-center gap-2">
        <div v-if="props.showScore" class="rounded-full border border-pink-200/20 bg-pink-500/10 px-3 py-1.5 text-sm text-pink-100">
          Score : {{ props.score ?? 0 }}
        </div>

        <button
          type="button"
          class="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-pink-50 transition hover:bg-white/10"
          @click="emit('back')"
        >
          Retour
        </button>

        <button
          type="button"
          class="rounded-full bg-pink-500/20 px-3 py-1.5 text-sm text-pink-100 ring-1 ring-pink-200/20 transition hover:bg-pink-500/30"
          @click="emit('replay')"
        >
          Rejouer
        </button>
      </div>
    </header>

    <slot />
  </div>
</template>
