<script setup lang="ts">
import { toRaw } from 'vue'

const props = defineProps<{
  code: string
  params: Record<string, number | string | boolean>
  renderType: 'points' | 'frames' | 'grille' | 'texte' | 'image'
}>()

const emit = defineEmits<{
  (event: 'result', value: Record<string, unknown>): void
  (event: 'error', value: string): void
}>()

const status = ref<'idle' | 'loading' | 'ready' | 'done' | 'error'>('idle')
const worker = ref<Worker | null>(null)
let latestRequestId = 0
let runTimeout: ReturnType<typeof setTimeout> | null = null

function ensureWorker() {
  if (!import.meta.client || worker.value) return

  worker.value = new Worker(new URL('../workers/pyodide-worker.js', import.meta.url), { type: 'module' })

  worker.value.onmessage = (event: MessageEvent) => {
    const message = event.data

    if (message?.type === 'ready') {
      status.value = 'ready'
      return
    }

    if (message?.type === 'result') {
      if (message.requestId !== latestRequestId) return
      status.value = 'done'
      emit('result', message.payload as Record<string, unknown>)
      return
    }

    if (message?.type === 'error') {
      if (message.requestId !== latestRequestId) return
      status.value = 'error'
      emit('error', message.message || 'Erreur inconnue du rendu Python.')
    }
  }

  worker.value.onerror = (event) => {
    status.value = 'error'
    emit('error', event.message || 'Le worker Python ne peut pas démarrer.')
  }

  worker.value.onmessageerror = () => {
    status.value = 'error'
    emit('error', 'Le worker Python a renvoyé un message illisible.')
  }
}

function run() {
  if (!import.meta.client || !props.code.trim()) return

  const payloadParams = JSON.parse(JSON.stringify(toRaw(props.params ?? {})))
  const requestId = ++latestRequestId

  ensureWorker()
  status.value = 'loading'
  worker.value?.postMessage({
    type: 'run',
    requestId,
    code: props.code,
    params: payloadParams,
    renderType: props.renderType
  })
}

watch(
  () => [props.code, props.renderType, JSON.stringify(props.params)] as const,
  () => {
    if (!import.meta.client || !props.code.trim()) return
    if (runTimeout) clearTimeout(runTimeout)
    runTimeout = setTimeout(() => {
      runTimeout = null
      run()
    }, 60)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (runTimeout) clearTimeout(runTimeout)
  worker.value?.terminate()
})
</script>

<template>
  <div class="mt-3 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-pink-100/70">
    <span class="inline-flex h-2.5 w-2.5 rounded-full" :class="{
      'bg-pink-300': status === 'loading',
      'bg-emerald-400': status === 'done',
      'bg-amber-300': status === 'ready',
      'bg-rose-400': status === 'error',
      'bg-white/40': status === 'idle'
    }" />
    <span>{{ status === 'loading' ? 'Préparation de la magie…' : status === 'done' ? 'Rendu calculé' : status === 'error' ? 'Erreur Python' : 'Prêt' }}</span>
  </div>
</template>
