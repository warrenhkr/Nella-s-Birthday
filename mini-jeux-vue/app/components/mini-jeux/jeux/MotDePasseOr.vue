<script setup lang="ts">
import { computed, ref } from 'vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import { RULES, estimateBits, unlockedCount } from '../../../utils/games/passwordrules'
import { useStopwatch } from '../../../utils/games/useStopwatch'
import { formatTime } from '../../../utils/games/format'

const EXAMPLE = 'Gateau!mai2058!'
const HINTS: Record<number, string> = {
  6: 'Additionne les chiffres un par un. Par exemple 2 + 0 + 5 + 8 = 15.',
  7: 'Évite « ll », « 00 », « !! »… Séparer deux lettres identiques suffit.',
  8: 'janvier, février, mars, avril, mai, juin, juillet, août, septembre, octobre, novembre ou décembre.',
  9: 'Une année comme 1995 ou 2058. Attention à la somme des chiffres !',
  10: 'Ajoute simplement un « ! » tout à la fin.',
}

const rules = [
  'Fabrique un mot de passe qui respecte toutes les règles. Elles apparaissent une par une : chaque nouvelle règle se débloque quand la précédente est satisfaite.',
  'Les règles sont volontairement un peu absurdes : c’est un jeu ! Dans la vraie vie, une longue phrase facile à retenir vaut mieux.',
  '⚠ N’écris jamais ton vrai mot de passe ici. Rien n’est enregistré ni envoyé, mais prends l’habitude de ne le saisir que sur les sites officiels.',
]

const phase = ref<GamePhase>('intro')
const password = ref('')
const hintShown = ref(false)
const gaveUp = ref(false)
const { elapsed, start: startClock, stop: stopClock } = useStopwatch()

const unlocked = computed(() => unlockedCount(password.value))
const visible = computed(() => RULES.slice(0, Math.min(unlocked.value + 1, RULES.length)))
const bits = computed(() => estimateBits(password.value))
const strength = computed(() => (bits.value < 28 ? { label: 'Faible', cls: 'bg-rose-500' } : bits.value < 60 ? { label: 'Moyen', cls: 'bg-amber-400' } : { label: 'Solide', cls: 'bg-emerald-400' }))
const nextRule = computed(() => RULES[unlocked.value])
const stats = computed(() => [
  { label: 'Règles', value: unlocked.value + '/' + RULES.length },
  { label: 'Longueur', value: password.value.length },
  { label: 'Temps', value: formatTime(elapsed.value) },
])

function start() {
  password.value = ''
  hintShown.value = false
  gaveUp.value = false
  phase.value = 'playing'
  startClock()
}

function onInput() {
  hintShown.value = false
  if (phase.value === 'playing' && unlockedCount(password.value) === RULES.length) {
    stopClock()
    phase.value = 'won'
  }
}

function giveUp() {
  stopClock()
  gaveUp.value = true
  phase.value = 'lost'
}

const resultTitle = computed(() => (phase.value === 'won' ? 'Mot de passe en or validé !' : 'Voici une solution possible'))
const resultText = computed(() =>
  phase.value === 'won'
    ? 'Réussi en ' + formatTime(elapsed.value) + '. Retiens : la longueur compte plus que les règles compliquées. Quatre mots au hasard font une excellente phrase de passe.'
    : 'Exemple qui respecte toutes les règles : ' + EXAMPLE,
)
</script>

<template>
  <GameShell
    title="Mot de passe en or"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :result-title="resultTitle"
    :result-text="resultText"
    intro-text="Un défi de créativité où le site devient de plus en plus exigeant."
    @start="start"
    @restart="start"
  >
    <div class="mx-auto max-w-lg">
      <label for="mdp-or" class="mb-1 block text-sm font-semibold text-violet-100">Ton mot de passe de jeu</label>
      <input
        id="mdp-or"
        v-model="password"
        type="text"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        class="min-h-12 w-full rounded-xl border border-violet-300/30 bg-violet-950 px-4 font-mono text-lg text-white placeholder-violet-400 focus:border-pink-300 focus:outline-none"
        placeholder="Écris ici…"
        :disabled="phase !== 'playing'"
        @input="onInput"
      />
      <div class="mt-2 flex items-center gap-3">
        <div class="h-2 flex-1 overflow-hidden rounded-full bg-violet-950">
          <div class="h-full rounded-full transition-all" :class="strength.cls" :style="{ width: Math.min(100, (bits / 90) * 100) + '%' }" />
        </div>
        <span class="text-xs text-violet-200">Force estimée : {{ strength.label }}</span>
      </div>
      <ul class="mt-4 space-y-2" aria-label="Règles à respecter">
        <li
          v-for="r in visible"
          :key="r.id"
          class="flex items-start gap-3 rounded-xl border px-3 py-2 text-sm"
          :class="r.test(password) ? 'border-emerald-300/40 bg-emerald-500/10 text-emerald-100' : 'border-rose-300/40 bg-rose-500/10 text-rose-100'"
        >
          <span class="font-bold" aria-hidden="true">{{ r.test(password) ? '✔' : '✘' }}</span>
          <span><span class="sr-only">{{ r.test(password) ? 'Respectée : ' : 'Non respectée : ' }}</span>Règle {{ r.id }} : {{ r.text }}</span>
        </li>
      </ul>
      <p v-if="hintShown && nextRule && HINTS[nextRule.id]" class="mt-3 rounded-xl bg-violet-900/60 p-3 text-sm text-violet-100">💡 {{ HINTS[nextRule.id] }}</p>
      <div class="mt-4 flex flex-wrap justify-center gap-2">
        <GameButton variant="ghost" small :disabled="phase !== 'playing' || !nextRule || !HINTS[nextRule.id]" @click="hintShown = true">💡 Indice</GameButton>
        <GameButton variant="ghost" small :disabled="phase !== 'playing'" @click="giveUp">🏳 Abandonner</GameButton>
      </div>
      <p v-if="gaveUp" class="sr-only">Partie abandonnée</p>
    </div>
  </GameShell>
</template>
