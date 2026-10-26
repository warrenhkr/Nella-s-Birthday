<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'

interface BoardItem {
  id: string
  title: string
  tag: string
  description: string
}

// accent en variable CSS plutôt qu'en classe Tailwind figée, pour que
// la teinte suive le thème actif (persona/cyberpunk, dark/light).
const items = ref<BoardItem[]>([
  { id: 'anime', title: 'Maraude Anime Club', tag: 'Anime', description: 'Séries du mois, clubs de discussion et recommandations culturelles.' },
  { id: 'gaming', title: 'Tournoi Campus', tag: 'Gaming', description: 'Rencontres, équipes, bracket et scoring pour les activités gaming.' },
  { id: 'danse', title: 'Crew Danse', tag: 'Danse', description: 'Répétitions, chorégraphies et animations culturelles du club.' },
  { id: 'culture', title: 'Culture Pop', tag: 'Culture', description: 'Ateliers mèmes, cosplay, références et moments de partage.' },
])
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-xs uppercase tracking-[0.25em] text-accent-otaku">Planning club</p>
        <h3 class="mt-2 text-xl font-semibold" style="color: var(--text-color);">À la une</h3>
      </div>
      <UBadge color="primary" variant="soft">Glisser pour trier</UBadge>
    </div>

    <VueDraggable
      v-model="items"
      class="space-y-3"
      handle=".kanban-item__handle"
      ghost-class="dnd-ghost"
      drag-class="dnd-drag"
      :animation="180"
    >
      <div v-for="item in items" :key="item.id" class="kanban-item surface-solid clip-corner-sm">
        <div class="mb-3 flex items-center justify-between gap-3">
          <span class="kanban-item__tag">{{ item.tag }}</span>
          <button type="button" class="kanban-item__handle" aria-label="Réordonner">
            <UIcon name="i-lucide-grip-vertical" class="h-4 w-4" />
          </button>
        </div>

        <h3 class="text-lg font-semibold" style="color: var(--text-color);">{{ item.title }}</h3>
        <p class="mt-2 text-sm text-muted">{{ item.description }}</p>
      </div>
    </VueDraggable>
  </div>
</template>

<style scoped>
.kanban-item {
  padding: 1rem;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
  will-change: transform;
}

.kanban-item__tag {
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  padding: 0.25rem 0.65rem;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--primary-color);
  background: rgba(var(--primary-color-rgb), 0.12);
  border: 1px solid rgba(var(--primary-color-rgb), 0.3);
}

.kanban-item__handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.5rem;
  color: var(--muted-color);
  cursor: grab;
  transition: color 0.18s ease, background-color 0.18s ease;
}

.kanban-item__handle:hover {
  color: var(--text-color);
  background: rgba(var(--accent-color-rgb), 0.1);
}

.kanban-item__handle:active {
  cursor: grabbing;
}
</style>
