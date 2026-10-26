<script setup lang="ts">
// Badge de statut de tournoi ou de match.
// Le statut est TOUJOURS porté par un texte + une pastille : jamais par la
// seule couleur (accessibilité). Les tons n'utilisent que les variables du
// thème, aucune teinte Tailwind figée.
type Tone = 'quiet' | 'neutral' | 'active' | 'done' | 'danger'

const props = defineProps<{
  status?: string | null
  label?: string
}>()

const MAP: Record<string, { label: string, tone: Tone }> = {
  draft: { label: 'Brouillon', tone: 'quiet' },
  registration_open: { label: 'Inscriptions ouvertes', tone: 'active' },
  checkin: { label: 'Contrôle des équipes', tone: 'active' },
  in_progress: { label: 'En cours', tone: 'active' },
  completed: { label: 'Terminé', tone: 'done' },
  cancelled: { label: 'Annulé', tone: 'danger' }
}

const normalized = computed(() => (props.status || 'draft').trim().toLowerCase().replace(/[\s-]+/g, '_'))

const entry = computed<{ label: string, tone: Tone }>(() => {
  const found = MAP[normalized.value]
  if (found) return found
  const raw = (props.status || '').trim()
  return { label: raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Inconnu', tone: 'neutral' }
})

const displayLabel = computed(() => props.label || entry.value.label)
const pulsing = computed(() => normalized.value === 'live' || normalized.value === 'in_progress')
</script>

<template>
  <span
    class="gaming-status"
    :class="[`gaming-status--${entry.tone}`, { 'gaming-status--pulsing': pulsing }]"
  >
    <span
      class="gaming-status__dot"
      aria-hidden="true"
    />
    <span class="gaming-status__text">{{ displayLabel }}</span>
  </span>
</template>

<style scoped>
.gaming-status {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border-radius: 9999px;
  border: 1px solid var(--border-color);
  padding: 0.2rem 0.6rem;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  white-space: nowrap;
  color: var(--text-color);
  background: rgba(var(--primary-color-rgb), 0.05);
}

.gaming-status__dot {
  height: 0.45rem;
  width: 0.45rem;
  flex: none;
  border-radius: 9999px;
  background: currentColor;
}

.gaming-status__text {
  color: inherit;
}

/* Brouillon / archivé : présent mais discret (pointillés, ton atténué). */
.gaming-status--quiet {
  border-style: dashed;
  color: var(--muted-color);
  background: transparent;
}

.gaming-status--neutral {
  color: var(--muted-color);
  background: rgba(var(--primary-color-rgb), 0.04);
}

.gaming-status--active {
  border-color: rgba(var(--primary-color-rgb), 0.45);
  color: var(--primary-color);
  background: rgba(var(--primary-color-rgb), 0.12);
}

.gaming-status--done {
  border-color: rgba(var(--accent-color-rgb), 0.4);
  color: var(--accent-color);
  background: rgba(var(--accent-color-rgb), 0.12);
}

.gaming-status--danger {
  border-color: rgba(var(--primary-color-rgb), 0.5);
  color: var(--primary-color);
  background: rgba(var(--primary-color-rgb), 0.16);
  text-decoration: line-through;
}

.gaming-status--pulsing .gaming-status__dot {
  animation: gaming-status-pulse 1.4s ease-in-out infinite;
}

@keyframes gaming-status-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.35; transform: scale(0.75); }
}

@media (prefers-reduced-motion: reduce) {
  .gaming-status--pulsing .gaming-status__dot { animation: none; }
}
</style>
