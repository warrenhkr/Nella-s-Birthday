<script setup lang="ts">
const questions = [
  {
    question: 'Quelle couleur évoque le plus le site d’Osnella Sènami ?',
    choices: ['Rose', 'Orange', 'Bleu', 'Noir'],
    answer: 'Rose'
  },
  {
    question: 'Quel mot résume le mieux la vibe de ce cadeau ?',
    choices: ['Magie', 'Ordinateur', 'Mauvais', 'Froid'],
    answer: 'Magie'
  },
  {
    question: 'Quel est le meilleur moyen de célébrer un anniversaire ?',
    choices: ['Avec amour', 'En silence', 'Sans surprise', 'Au hasard'],
    answer: 'Avec amour'
  },
  {
    question: 'Que cherche le cœur quand il aime ?',
    choices: ['Le cadeau parfait', 'La vraie présence', 'Le plus grand écran', 'Le plus vieux code'],
    answer: 'La vraie présence'
  }
]

const index = ref(0)
const score = ref(0)
const finished = ref(false)
const selected = ref<string | null>(null)

const currentQuestion = computed(() => questions[index.value] ?? questions[0])

function answer(choice: string) {
  if (selected.value) return

  const question = currentQuestion.value
  if (!question) return

  selected.value = choice

  if (choice === question.answer) {
    score.value += 1
  }

  setTimeout(() => {
    if (index.value < questions.length - 1) {
      index.value += 1
      selected.value = null
    } else {
      finished.value = true
    }
  }, 650)
}

function restart() {
  index.value = 0
  score.value = 0
  finished.value = false
  selected.value = null
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="!finished" class="rounded-2xl border border-pink-200/10 bg-[#140d1c] p-4 text-pink-100">
      <div class="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-pink-100/70">
        <span>Question {{ index + 1 }}/{{ questions.length }}</span>
        <span>Score {{ score }}</span>
      </div>

      <h2 class="text-xl font-semibold text-white">{{ currentQuestion?.question }}</h2>

      <div v-if="currentQuestion" class="mt-4 grid gap-3">
        <button
          v-for="choice in currentQuestion.choices"
          :key="choice"
          type="button"
          class="rounded-2xl border px-3 py-3 text-left text-sm transition"
          :class="selected === null
            ? 'border-white/10 bg-white/5 text-pink-50 hover:bg-white/10'
            : choice === currentQuestion.answer
              ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
              : choice === selected
                ? 'border-rose-400/30 bg-rose-500/10 text-rose-100'
                : 'border-white/10 bg-white/5 text-pink-50/80'"
          @click="answer(choice)"
        >
          {{ choice }}
        </button>
      </div>
    </div>

    <div v-else class="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-emerald-100">
      <p class="text-lg font-semibold">Quiz terminé !</p>
      <p class="mt-2">Tu as obtenu {{ score }} / {{ questions.length }} bonne(s) réponse(s).</p>
      <button type="button" class="mt-4 rounded-full bg-emerald-500/20 px-3 py-2 text-sm text-emerald-50" @click="restart">
        Rejouer
      </button>
    </div>
  </div>
</template>
