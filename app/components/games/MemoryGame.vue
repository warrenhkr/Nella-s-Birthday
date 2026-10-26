<script setup lang="ts">
type Card = {
  id: number
  symbol: string
  matched: boolean
}

const symbols = ['💖', '✨', '🎀', '🎵', '🩷', '🌙']
const cards = ref<Card[]>([])
const selectedIndexes = ref<number[]>([])
const moves = ref(0)
const seconds = ref(0)
const solved = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

function buildDeck() {
  const deck: Card[] = []

  symbols.forEach((symbol, index) => {
    deck.push({ id: index * 2, symbol, matched: false })
    deck.push({ id: index * 2 + 1, symbol, matched: false })
  })

  return deck
    .map((card) => ({ ...card, id: Math.random() * 100000 + card.id }))
    .sort(() => Math.random() - 0.5)
}

function resetGame() {
  cards.value = buildDeck()
  selectedIndexes.value = []
  moves.value = 0
  seconds.value = 0
  solved.value = false

  if (timer) {
    clearInterval(timer)
  }

  timer = setInterval(() => {
    seconds.value += 1
  }, 1000)
}

function selectCard(index: number) {
  if (selectedIndexes.value.length >= 2) return
  if (cards.value[index]?.matched) return
  if (selectedIndexes.value.includes(index)) return

  selectedIndexes.value = [...selectedIndexes.value, index]

  if (selectedIndexes.value.length !== 2) return

  const firstIndex = selectedIndexes.value[0]
  const secondIndex = selectedIndexes.value[1]

  if (firstIndex === undefined || secondIndex === undefined) {
    selectedIndexes.value = []
    return
  }

  moves.value += 1
  const firstCard = cards.value[firstIndex]
  const secondCard = cards.value[secondIndex]

  if (!firstCard || !secondCard) {
    selectedIndexes.value = []
    return
  }

  if (firstCard.symbol === secondCard.symbol) {
    const firstMatch = cards.value[firstIndex]
    const secondMatch = cards.value[secondIndex]

    if (firstMatch && secondMatch) {
      firstMatch.matched = true
      secondMatch.matched = true
    }

    selectedIndexes.value = []

    if (cards.value.every((card) => card.matched)) {
      solved.value = true
      clearInterval(timer)
    }

    return
  }

  setTimeout(() => {
    selectedIndexes.value = []
  }, 550)
}

onMounted(() => {
  resetGame()
})

onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer)
  }
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-pink-200/10 bg-[#140d1c] p-3 text-sm text-pink-100/80">
      <span>Coups: {{ moves }}</span>
      <span>Temps: {{ seconds }}s</span>
      <span>Objectif: {{ cards.filter((card) => card.matched).length / 2 }}/{{ symbols.length }}</span>
    </div>

    <div class="grid grid-cols-3 gap-3 sm:grid-cols-4">
      <button
        v-for="(card, index) in cards"
        :key="card.id"
        type="button"
        class="aspect-square rounded-2xl border text-2xl transition duration-200"
        :class="selectedIndexes.includes(index) || card.matched
          ? 'border-pink-200/30 bg-pink-500/10 text-pink-100'
          : 'border-white/10 bg-[#120b1d] text-transparent hover:border-pink-200/20'"
        @click="selectCard(index)"
      >
        {{ selectedIndexes.includes(index) || card.matched ? card.symbol : '✦' }}
      </button>
    </div>

    <div v-if="solved" class="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
      Victoire ! Tu as réussi le souvenir parfait en {{ moves }} coups.
    </div>
  </div>
</template>
