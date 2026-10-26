<script setup lang="ts">
const props = withDefaults(defineProps<{
  currentPage: number
  totalPages: number
  itemCount?: number
  itemLabel?: string
  compact?: boolean
}>(), {
  itemCount: undefined,
  itemLabel: 'résultat',
  compact: false
})

const emit = defineEmits<{
  (e: 'page-change', page: number): void
}>()

const touchStartX = ref<number | null>(null)

function clampPage(page: number) {
  return Math.min(Math.max(page, 1), Math.max(props.totalPages, 1))
}

function goToPage(page: number) {
  const target = clampPage(page)
  if (target === props.currentPage) return
  emit('page-change', target)
}

function onTouchStart(event: TouchEvent) {
  const touch = event.changedTouches?.[0]
  touchStartX.value = touch ? touch.clientX : null
}

function onTouchEnd(event: TouchEvent) {
  if (touchStartX.value === null) return

  const touch = event.changedTouches?.[0]
  if (!touch) {
    touchStartX.value = null
    return
  }

  const deltaX = touch.clientX - touchStartX.value
  touchStartX.value = null

  if (Math.abs(deltaX) < 50) return

  if (deltaX < 0 && props.currentPage < props.totalPages) {
    goToPage(props.currentPage + 1)
  } else if (deltaX > 0 && props.currentPage > 1) {
    goToPage(props.currentPage - 1)
  }
}
</script>

<template>
  <div
    v-if="totalPages > 1"
    class="app-pagination"
    :class="{ 'app-pagination--compact': compact }"
    @touchstart="onTouchStart"
    @touchend="onTouchEnd"
  >
    <span class="app-pagination__label">
      Page {{ currentPage }} / {{ totalPages }}
      <template v-if="itemCount !== undefined">
        · {{ itemCount }} {{ itemLabel }}{{ itemCount > 1 ? 's' : '' }}
      </template>
    </span>

    <div class="app-pagination__actions">
      <UButton
        color="neutral"
        variant="soft"
        icon="i-lucide-chevron-left"
        aria-label="Page précédente"
        :disabled="currentPage === 1"
        @click="goToPage(currentPage - 1)"
      />
      <UButton
        color="neutral"
        variant="soft"
        icon="i-lucide-chevron-right"
        aria-label="Page suivante"
        :disabled="currentPage === totalPages"
        @click="goToPage(currentPage + 1)"
      />
    </div>
  </div>
</template>

<style scoped>
.app-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}

.app-pagination--compact {
  margin-top: 0.5rem;
}

.app-pagination__label {
  color: var(--muted-color, #6b7280);
  font-size: 0.8125rem;
}

.app-pagination__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
