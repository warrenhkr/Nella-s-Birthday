// ============================================================
// useDraggableWidget — drag & drop libre (widgets flottants, pas
// une liste triable) via useDraggable de @vueuse/core.
// Optimisé GPU : on ne déplace l'élément qu'avec transform
// (translate3d), jamais top/left, pour rester sur le compositeur.
//
// Pour la RÉORGANISATION de listes (tri d'items), voir plutôt
// SortableKanban.vue (déjà présent, basé sur @dnd-kit/sortable).
// ============================================================
import { useDraggable } from '@vueuse/core'
import type { Ref } from 'vue'

interface DraggableWidgetOptions {
  initialX?: number
  initialY?: number
}

export function useDraggableWidget(target: Ref<HTMLElement | null>, options: DraggableWidgetOptions = {}) {
  const { x, y, style, isDragging } = useDraggable(target, {
    initialValue: { x: options.initialX ?? 0, y: options.initialY ?? 0 },
    // useDraggable applique déjà `transform: translate` sous le capot
    // plutôt que top/left — c'est ce qui garde l'animation sur le GPU.
  })

  return { x, y, style, isDragging }
}
