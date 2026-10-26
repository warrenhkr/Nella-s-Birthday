<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

type AppNotification = {
  id: string
  title: string
  body: string | null
  type: string | null
  isRead: boolean
  createdAt: string
}

// Durée d'affichage avant fermeture automatique d'une notification (15 s : le
// temps de lire le message sans qu'il reste à l'écran). S'applique à TOUS les
// types de notifications, pas seulement aux changements de rôle.
const NOTIFICATION_AUTO_DISMISS_MS = 15000

const MARK_READ_ENDPOINT = '/api/notifications/mark-read'

const { data, pending, refresh } = await useFetch<{ data: AppNotification[] }>('/api/notifications')

// Notifications déjà traitées côté interface : elles sont marquées comme lues en
// base et disparaissent immédiatement de la liste sans attendre le refresh.
const dismissedIds = ref<string[]>([])

const notifications = computed(() =>
  (data.value?.data || []).filter(note => !dismissedIds.value.includes(note.id))
)

// Toutes les notifications affichées sont candidates à la fermeture automatique.
const displayedIds = computed(() => notifications.value.map(note => note.id))

const selected = ref<string[]>([])
const containerRef = ref<HTMLElement | null>(null)

let autoDismissTimer: ReturnType<typeof setTimeout> | undefined
// Suivi du temps restant pour reprendre le compte à rebours au même endroit
// après un survol ou une interaction clavier.
let autoDismissDeadline = 0
let autoDismissRemaining = NOTIFICATION_AUTO_DISMISS_MS
// Vrai pendant un survol ou tant que le focus reste dans le panneau : la
// fermeture automatique est suspendue pour ne pas fermer sous le curseur.
let autoDismissPaused = false

// Nettoyage centralisé du minuteur (évite toute fuite mémoire et tout double déclenchement).
function clearAutoDismissTimer() {
  if (autoDismissTimer) {
    clearTimeout(autoDismissTimer)
    autoDismissTimer = undefined
  }
}

async function markIdsRead(ids: string[]) {
  if (!ids.length) return

  try {
    await $fetch(MARK_READ_ENDPOINT as string, {
      method: 'POST',
      body: { ids }
    })
  } catch {
    // En cas d'échec réseau on garde la notification visible pour ne rien perdre.
    return
  }

  dismissedIds.value = [...new Set([...dismissedIds.value, ...ids])]
  await refresh()
}

// Marque TOUTES les notifications non lues de l'utilisateur en une seule requête.
async function markAllRead() {
  const ids = displayedIds.value
  if (!ids.length) return

  try {
    await $fetch(MARK_READ_ENDPOINT as string, {
      method: 'POST',
      body: { all: true }
    })
  } catch {
    return
  }

  dismissedIds.value = [...new Set([...dismissedIds.value, ...ids])]
  await refresh()
}

function scheduleAutoDismiss(delay: number) {
  clearAutoDismissTimer()
  if (autoDismissPaused) return

  const ids = displayedIds.value
  if (!ids.length) return

  autoDismissRemaining = delay
  autoDismissDeadline = Date.now() + delay
  autoDismissTimer = setTimeout(() => {
    autoDismissTimer = undefined
    void markAllRead()
  }, delay)
}

function pauseAutoDismiss() {
  if (autoDismissPaused) return
  autoDismissPaused = true
  if (autoDismissTimer) {
    autoDismissRemaining = Math.max(1000, autoDismissDeadline - Date.now())
    clearAutoDismissTimer()
  }
}

function resumeAutoDismiss() {
  if (!autoDismissPaused) return
  autoDismissPaused = false
  scheduleAutoDismiss(autoDismissRemaining)
}

// Le focus qui se déplace à l'intérieur du panneau (ex. case à cocher -> bouton)
// ne doit pas relancer le minuteur : il reprend seulement quand le focus sort.
function onPanelFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  if (next && containerRef.value?.contains(next)) return
  resumeAutoDismiss()
}

onMounted(() => {
  scheduleAutoDismiss(NOTIFICATION_AUTO_DISMISS_MS)
})

watch(displayedIds, () => {
  // Nouvelles notifications : on repart d'un délai complet.
  scheduleAutoDismiss(NOTIFICATION_AUTO_DISMISS_MS)
}, { flush: 'post' })

onBeforeUnmount(() => {
  clearAutoDismissTimer()
  // Si l'utilisateur quitte le dashboard avant la fin du minuteur, on marque
  // quand même comme lues les notifications réellement affichées : elles ne
  // doivent pas revenir à la prochaine visite (elles ont déjà été vues).
  const ids = displayedIds.value
  if (ids.length && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    navigator.sendBeacon(
      MARK_READ_ENDPOINT,
      new Blob([JSON.stringify({ ids })], { type: 'application/json' })
    )
  }
})

async function markSelectedRead() {
  if (!selected.value.length) return
  await $fetch(MARK_READ_ENDPOINT as string, { method: 'POST', body: { ids: selected.value } })
  dismissedIds.value = [...new Set([...dismissedIds.value, ...selected.value])]
  selected.value = []
  await refresh()
}
</script>

<template>
  <div
    ref="containerRef"
    class="surface-solid p-4"
    @mouseenter="pauseAutoDismiss"
    @mouseleave="resumeAutoDismiss"
    @focusin="pauseAutoDismiss"
    @focusout="onPanelFocusOut"
  >
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-semibold">Notifications</h3>
      <div class="flex items-center gap-1">
        <UButton size="sm" color="primary" variant="ghost" label="Marquer lu" @click="markSelectedRead" />
        <UButton size="sm" color="neutral" variant="ghost" label="Tout marquer comme lu" @click="markAllRead" />
      </div>
    </div>

    <div v-if="pending" class="space-y-2">
      <USkeleton class="h-10" v-for="i in 3" :key="i" />
    </div>

    <div v-else-if="notifications.length === 0" class="text-sm text-muted">Aucune notification.</div>

    <ul v-else class="space-y-2">
      <li v-for="note in notifications" :key="note.id" class="p-2 border rounded flex items-start gap-3" :class="{ 'opacity-60': note.isRead }">
        <input type="checkbox" v-model="selected" :value="note.id" />
        <div>
          <div class="text-sm font-medium">{{ note.title }}</div>
          <div class="text-xs text-muted">{{ note.body }}</div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
</style>
