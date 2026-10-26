<script setup lang="ts">
defineProps<{
  title: string
  meta?: string
  badge?: string
}>()
</script>

<template>
  <UCard class="rounded-xl border border-default bg-white/5 shadow-none backdrop-blur-md">
    <template #header>
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-xs uppercase tracking-wider text-primary">{{ meta }}</p>
          <h3 class="mt-1 text-lg font-semibold text-highlighted">{{ title }}</h3>
        </div>
        <UBadge v-if="badge" color="primary" variant="soft">{{ badge }}</UBadge>
      </div>
    </template>
    <slot />
  </UCard>
</template>
