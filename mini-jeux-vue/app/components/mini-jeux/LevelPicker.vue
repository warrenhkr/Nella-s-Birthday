<script setup lang="ts">
/** Choix d'un niveau de difficulté (boutons radio stylés, utilisables au doigt). */
defineProps<{ options: { key: string; label: string }[]; modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()
</script>

<template>
  <div class="mb-5" role="radiogroup" aria-label="Niveau">
    <p class="mb-2 text-sm font-semibold uppercase tracking-wide text-pink-200">Niveau</p>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="o in options"
        :key="o.key"
        type="button"
        role="radio"
        :aria-checked="o.key === modelValue"
        class="min-h-10 rounded-xl border px-3 text-sm font-medium transition active:scale-95"
        :class="o.key === modelValue ? 'border-pink-300 bg-pink-500/30 text-white' : 'border-violet-300/30 bg-violet-900/30 text-violet-100 hover:bg-violet-800/40'"
        @click="emit('update:modelValue', o.key)"
      >
        {{ o.label }}
      </button>
    </div>
  </div>
</template>
