<script setup lang="ts">
import { algos } from '../../data/algos'
import PointsRenderer from '../../components/algos/PointsRenderer.vue'
import GridRenderer from '../../components/algos/GridRenderer.vue'
import TextRenderer from '../../components/algos/TextRenderer.vue'
import ImageRenderer from '../../components/algos/ImageRenderer.vue'
import FramesRenderer from '../../components/algos/FramesRenderer.vue'
import PyodideRunner from '../../components/PyodideRunner.vue'
import type { AlgoAnimationMode } from '../../data/algos'

const route = useRoute()
const sourceCode = ref('')
const sourceStatus = ref<'loading' | 'ready' | 'error'>('loading')
const sourceError = ref('')
const renderResult = ref<Record<string, unknown> | null>(null)
const runnerError = ref('')
const replayToken = ref(0)
const isPlaying = ref(false)
const selectedAnimationModeId = ref('custom')
let sourceRequestId = 0

const algo = computed(() => algos.find(item => item.id === String(route.params.id)))
useHead(() => ({ title: algo.value?.title ?? 'Algorithme introuvable' }))
const algoIndex = computed(() => algos.findIndex(item => item.id === String(route.params.id)))
const previousAlgo = computed(() => algos[(algoIndex.value - 1 + algos.length) % algos.length]!)
const nextAlgo = computed(() => algos[(algoIndex.value + 1) % algos.length]!)
const paramNames = computed(() => algo.value?.parameters ?? [])
const paramValues = ref<Record<string, number | string | boolean>>({})
const supportsReplay = computed(() => {
  const result = renderResult.value
  if (!result || !algo.value) return false

  if (algo.value.renderType === 'frames') {
    return Array.isArray(result.frames) && result.frames.length > 1
  }
  if (algo.value.renderType === 'points' || algo.value.renderType === 'grille') {
    return Array.isArray(result.keyframes) && result.keyframes.length > 1
  }
  if (algo.value.renderType === 'texte') {
    return Array.isArray(result.lines) && result.lines.length > 1
  }

  return false
})
const selectedAnimationMode = computed(() => algo.value?.animationModes.find((mode) => mode.id === selectedAnimationModeId.value))
const animationSpeed = computed(() => selectedAnimationMode.value?.speed ?? 1)

function buildDefaultParams(value = algo.value) {
  const defaults: Record<string, number | string | boolean> = {}

  value?.parameters.forEach((parameter) => {
    defaults[parameter.name] = parameter.default
  })

  return defaults
}

async function loadSource(value = algo.value) {
  const requestId = ++sourceRequestId
  sourceCode.value = ''
  sourceError.value = ''
  sourceStatus.value = 'loading'

  if (!value) {
    sourceStatus.value = 'error'
    sourceError.value = 'Algorithme introuvable.'
    return
  }

  renderResult.value = null
  runnerError.value = ''
  isPlaying.value = false
  selectedAnimationModeId.value = 'custom'

  paramValues.value = buildDefaultParams(value)

  try {
    const response = await fetch(value.file, {
      headers: {
        Accept: 'text/plain, text/python, */*'
      }
    })
    if (!response.ok) throw new Error(`réponse HTTP ${response.status}`)

    const code = await response.text()
    if (!code.trim()) throw new Error('le fichier Python est vide')
    if (requestId !== sourceRequestId) return

    sourceCode.value = code
    sourceStatus.value = 'ready'
  } catch (error) {
    if (requestId !== sourceRequestId) return
    sourceStatus.value = 'error'
    sourceError.value = `Impossible de charger le script Python : ${error instanceof Error ? error.message : String(error)}`
  }
}

watch(
  () => route.params.id,
  (id, previousId) => {
    if (!id) {
      sourceStatus.value = 'error'
      sourceError.value = 'Algorithme introuvable.'
      renderResult.value = null
      runnerError.value = ''
      return
    }

    if (previousId === id && sourceStatus.value === 'ready') {
      return
    }

    if (!import.meta.client) return
    void nextTick(() => {
      void loadSource(algo.value)
    })
  },
  { immediate: true }
)

onMounted(() => {
  if (!route.params.id) {
    sourceStatus.value = 'error'
    sourceError.value = 'Algorithme introuvable.'
    renderResult.value = null
    runnerError.value = ''
    return
  }

  void nextTick(() => {
    void loadSource(algo.value)
  })
})

function setParam(name: string, value: number | string | boolean) {
  const parameter = algo.value?.parameters.find((item) => item.name === name)

  selectedAnimationModeId.value = 'custom'
  if (parameter?.type === 'boolean' && typeof value === 'string') {
    paramValues.value[name] = value === 'true'
    return
  }

  paramValues.value[name] = value
}

function resetParams() {
  if (!algo.value) return

  paramValues.value = buildDefaultParams(algo.value)
  selectedAnimationModeId.value = 'custom'
  isPlaying.value = false
  replayToken.value += 1
}

function applyAnimationMode(modeId: AlgoAnimationMode['id'] | 'custom') {
  selectedAnimationModeId.value = modeId
  isPlaying.value = false

  const mode = algo.value?.animationModes.find((item) => item.id === modeId)
  if (!mode) return

  paramValues.value = { ...paramValues.value, ...mode.params }
  replayToken.value += 1
}

function replayAlgorithm() {
  if (!supportsReplay.value) return
  isPlaying.value = true
  replayToken.value += 1
}

function handleRenderResult(result: Record<string, unknown>) {
  renderResult.value = result
  runnerError.value = ''
  isPlaying.value = false
}

const previewSummary = computed(() => {
  if (!algo.value) return 'Algorithme introuvable.'

  const parts = paramNames.value.map((parameter) => {
    const value = paramValues.value[parameter.name]
    return `${parameter.name}: ${value ?? parameter.default}`
  })

  return parts.length ? parts.join(' • ') : 'Aucun paramètre configurable.'
})
const resultSummary = computed(() => {
  const summary = renderResult.value?.summary
  return summary && typeof summary === 'object' && !Array.isArray(summary)
    ? Object.entries(summary as Record<string, unknown>)
    : []
})
const resultSegments = computed(() => {
  const names = renderResult.value?.segments
  const sizes = renderResult.value?.clusters
  if (!Array.isArray(names) || !Array.isArray(sizes)) return []
  return names.map((name, index) => ({ name: String(name), size: Number(sizes[index] ?? 0) }))
})

function formatResultValue(value: unknown) {
  if (Array.isArray(value)) return value.join(' · ')
  if (value && typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
  return String(value)
}
</script>

<template>
  <main class="theme-page min-h-dvh px-4 py-8 sm:px-6 lg:px-8">
    <div v-if="algo" class="mx-auto max-w-5xl">
      <header class="mb-6">
        <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
          <NuxtLink
            to="/algos"
            class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-pink-100 transition hover:bg-white/10"
          >
            <UIcon name="i-lucide-arrow-left" class="h-4 w-4" />
            Retour aux algorithmes
          </NuxtLink>
          <nav
            class="flex gap-2"
            aria-label="Navigation entre les algorithmes"
          >
            <NuxtLink
              :to="`/algos/${previousAlgo.id}`"
              class="rounded-lg px-3 py-2 text-sm text-pink-100 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
              :aria-label="'Algorithme précédent : ' + previousAlgo.title"
            >
              ‹ Précédent
            </NuxtLink>
            <NuxtLink
              :to="`/algos/${nextAlgo.id}`"
              class="rounded-lg px-3 py-2 text-sm text-pink-100 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
              :aria-label="'Algorithme suivant : ' + nextAlgo.title"
            >
              Suivant ›
            </NuxtLink>
          </nav>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <span class="rounded-full border border-pink-200/20 bg-pink-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.24em] text-pink-100/80">
            {{ algo.renderType }}
          </span>
          <span v-for="tag in algo.tags" :key="tag" class="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-pink-50/80">
            {{ tag }}
          </span>
        </div>

        <h1 class="mt-4 text-3xl font-semibold text-pink-100 sm:text-4xl">
          {{ algo.title }}
        </h1>
        <p class="mt-3 max-w-3xl text-sm leading-6 text-pink-50/80 sm:text-base">
          {{ algo.description }}
        </p>
      </header>

      <section class="grid min-w-0 gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside class="min-w-0 rounded-3xl border border-pink-200/15 bg-white/5 p-4 backdrop-blur-sm lg:sticky lg:top-4 lg:self-start">
          <div class="mb-4 flex items-center justify-between gap-3">
            <h2 class="text-sm uppercase tracking-[0.28em] text-pink-100/80">
              Paramètres
            </h2>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-pink-100 transition hover:bg-white/10"
              @click="resetParams"
            >
              <UIcon name="i-lucide-rotate-ccw" class="h-3.5 w-3.5" />
              Réinitialiser
            </button>
          </div>

          <div class="max-h-[min(65dvh,720px)] space-y-5 overflow-y-auto overscroll-y-auto pr-2">
            <div v-if="algo.animationModes.length" class="space-y-2">
              <label for="animation-mode" class="block text-sm font-medium text-pink-50/90">
                Style d’animation
              </label>
              <select
                id="animation-mode"
                :value="selectedAnimationModeId"
                class="w-full rounded-2xl border border-white/10 bg-[#1a0f22] px-3 py-2 text-sm text-white outline-none ring-0"
                @change="applyAnimationMode(($event.target as HTMLSelectElement).value)"
              >
                <option value="custom">Personnalisé</option>
                <option v-for="mode in algo.animationModes" :key="mode.id" :value="mode.id">
                  {{ mode.label }}
                </option>
              </select>
              <p class="text-xs leading-5 text-pink-100/60">
                {{ selectedAnimationMode?.description ?? 'Choisis un profil adapté à cet algorithme, ou ajuste les paramètres librement.' }}
              </p>
            </div>

            <div class="space-y-4">
              <div v-for="parameter in paramNames" :key="parameter.name" class="space-y-2">
                <label class="block text-sm font-medium text-pink-50/90">
                  {{ parameter.label }}
                </label>

                <template v-if="parameter.type === 'select'">
                  <select
                    :value="String(paramValues[parameter.name] ?? parameter.default)"
                    class="w-full rounded-2xl border border-white/10 bg-[#1a0f22] px-3 py-2 text-sm text-white outline-none ring-0"
                    @change="setParam(parameter.name, ($event.target as HTMLSelectElement).value)"
                  >
                    <option v-for="option in parameter.options" :key="option" :value="option">
                      {{ option }}
                    </option>
                  </select>
                </template>

                <template v-else-if="parameter.type === 'boolean'">
                  <button
                    type="button"
                    class="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-[#1a0f22] px-3 py-2 text-sm text-white"
                    @click="setParam(parameter.name, String(!(paramValues[parameter.name] as boolean)) )"
                  >
                    <span>{{ paramValues[parameter.name] ? 'Activé' : 'Désactivé' }}</span>
                    <UIcon :name="paramValues[parameter.name] ? 'i-lucide-check' : 'i-lucide-x'" class="h-4 w-4" />
                  </button>
                </template>

                <template v-else-if="parameter.type === 'text' && parameter.name !== 'color' && !parameter.name.endsWith('_color')">
                  <input
                    :value="String(paramValues[parameter.name] ?? parameter.default)"
                    type="text"
                    class="w-full rounded-2xl border border-white/10 bg-[#1a0f22] px-3 py-2 text-sm text-white outline-none focus:border-pink-200/50"
                    :minlength="parameter.min"
                    :maxlength="parameter.max"
                    @input="setParam(parameter.name, ($event.target as HTMLInputElement).value)"
                  />
                </template>

                <template v-else-if="parameter.type === 'text'">
                  <input
                    :value="String(paramValues[parameter.name] ?? parameter.default)"
                    type="color"
                    class="h-10 w-full cursor-pointer rounded-xl border border-white/10 bg-[#1a0f22] p-1"
                    @input="setParam(parameter.name, ($event.target as HTMLInputElement).value)"
                  />
                </template>

                <template v-else>
                  <input
                    :value="Number(paramValues[parameter.name] ?? parameter.default)"
                    type="range"
                    class="w-full accent-pink-400"
                    :min="parameter.min"
                    :max="parameter.max"
                    :step="parameter.type === 'integer' ? 1 : 0.01"
                    @input="setParam(parameter.name, Number(($event.target as HTMLInputElement).value))"
                  />
                  <div class="text-right text-xs text-pink-100/70">
                    {{ paramValues[parameter.name] ?? parameter.default }}
                  </div>
                </template>
              </div>
            </div>
          </div>
        </aside>

        <div class="min-w-0 rounded-3xl border border-pink-200/15 bg-white/5 p-4 backdrop-blur-sm">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-sm uppercase tracking-[0.28em] text-pink-100/80">
                Aperçu
              </h2>
              <span class="mt-1 block text-xs text-pink-100/60">
                {{ previewSummary }}
              </span>
            </div>
            <button
              v-if="supportsReplay"
              type="button"
              class="inline-flex items-center gap-2 rounded-full border border-pink-200/25 bg-pink-500/15 px-4 py-2 text-sm font-medium text-pink-50 transition hover:bg-pink-500/25"
              @click="replayAlgorithm"
            >
              <UIcon name="i-lucide-play" class="h-4 w-4" />
              {{ isPlaying ? 'Rejouer' : 'Jouer l’algorithme' }}
            </button>
          </div>

          <div class="min-w-0 overflow-hidden rounded-[28px] border border-dashed border-pink-200/25 bg-[#120b1d] p-3">
            <h3 v-if="renderResult?.title" class="mb-3 text-center text-sm font-semibold text-pink-100">
              {{ renderResult.title }}
            </h3>
            <PointsRenderer v-if="algo.renderType === 'points' && renderResult" :result="renderResult" :playing="isPlaying" :replay-token="replayToken" :playback-speed="animationSpeed" />
            <GridRenderer v-else-if="algo.renderType === 'grille' && renderResult" :result="renderResult" :playing="isPlaying" :replay-token="replayToken" :playback-speed="animationSpeed" />
            <TextRenderer v-else-if="algo.renderType === 'texte' && renderResult" :result="renderResult" :playing="isPlaying" :replay-token="replayToken" :playback-speed="animationSpeed" />
            <ImageRenderer v-else-if="algo.renderType === 'image' && renderResult" :result="renderResult" />
            <FramesRenderer v-else-if="algo.renderType === 'frames' && renderResult" :result="renderResult" :playing="isPlaying" :replay-token="replayToken" :playback-speed="animationSpeed" />

            <div v-else class="flex min-h-90 items-center justify-center">
              <div class="rounded-full border border-pink-200/10 bg-pink-500/10 p-7 shadow-[0_0_50px_rgba(255,120,180,0.2)]">
                <UIcon
                  :name="algo.renderType === 'grille' ? 'i-lucide-grid-3x3' : algo.renderType === 'texte' ? 'i-lucide-type' : algo.renderType === 'image' ? 'i-lucide-image' : algo.renderType === 'frames' ? 'i-lucide-film' : 'i-lucide-heart'"
                  class="h-20 w-20 text-pink-200"
                />
              </div>
            </div>
          </div>

          <dl v-if="resultSummary.length" class="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Résultats calculés">
            <div v-for="([label, value]) in resultSummary" :key="label" class="min-w-0 rounded-lg border border-pink-200/10 bg-white/5 px-3 py-2">
              <dt class="break-words text-xs text-pink-100/60">{{ label.replaceAll('_', ' ') }}</dt>
              <dd class="mt-1 break-words text-sm font-medium text-pink-50">{{ formatResultValue(value) }}</dd>
            </div>
          </dl>
          <ul v-if="resultSegments.length" class="mt-3 flex flex-wrap gap-2" aria-label="Segments clients">
            <li v-for="segment in resultSegments" :key="segment.name" class="rounded-lg border border-pink-200/15 bg-white/5 px-3 py-2 text-sm text-pink-50">
              {{ segment.name }} <span class="text-pink-100/60">· {{ segment.size }} clients</span>
            </li>
          </ul>

          <PyodideRunner
            v-if="sourceCode"
            :key="algo.id"
            :code="sourceCode"
            :params="paramValues"
            :render-type="algo.renderType"
            @result="handleRenderResult"
            @error="runnerError = $event"
          />

          <div v-if="sourceError" class="mt-3 rounded-2xl border border-rose-300/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-100" role="alert">
            {{ sourceError }}
          </div>

          <div v-if="runnerError" class="mt-3 rounded-2xl border border-rose-300/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
            {{ runnerError }}
          </div>
        </div>
      </section>

      <section class="mt-6 rounded-3xl border border-pink-200/15 bg-white/5 p-4 backdrop-blur-sm">
        <h2 class="mb-3 text-sm uppercase tracking-[0.28em] text-pink-100/80">
          Fichier Python
        </h2>
        <pre class="max-h-130 overflow-auto rounded-2xl bg-[#140d1c] p-4 text-xs leading-6 text-pink-50/80"><code>{{ sourceStatus === 'loading' ? 'Chargement du script Python…' : sourceError || sourceCode }}</code></pre>
      </section>
    </div>

    <div v-else class="mx-auto max-w-xl rounded-3xl border border-pink-200/15 bg-white/5 p-8 text-center text-pink-50/80">
      <p class="text-lg font-medium text-white">Algorithme introuvable.</p>
      <NuxtLink to="/algos" class="mt-4 inline-block rounded-full bg-pink-500/20 px-4 py-2 text-sm text-pink-100">
        Revenir à la liste
      </NuxtLink>
    </div>
  </main>
</template>
