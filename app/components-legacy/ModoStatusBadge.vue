<script setup lang="ts">
type ModoStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED'

const props = withDefaults(defineProps<{
  status: ModoStatus
  size?: 'sm' | 'md' | 'lg'
}>(), { size: 'md' })

// Couleurs sémantiques @nuxt/ui uniquement (jamais `secondary`, bleu par défaut en v4).
const META: Record<ModoStatus, { label: string, color: 'neutral' | 'success' | 'error' | 'warning', icon: string }> = {
  PENDING: { label: 'En attente', color: 'neutral', icon: 'i-lucide-clock' },
  APPROVED: { label: 'Approuvé', color: 'success', icon: 'i-lucide-circle-check' },
  REJECTED: { label: 'Rejeté', color: 'error', icon: 'i-lucide-circle-x' },
  FLAGGED: { label: 'Signalé', color: 'warning', icon: 'i-lucide-flag' }
}

const meta = computed(() => META[props.status])
</script>

<template>
  <UBadge
    :color="meta.color"
    :icon="meta.icon"
    :size="size"
    variant="soft"
  >
    {{ meta.label }}
  </UBadge>
</template>
