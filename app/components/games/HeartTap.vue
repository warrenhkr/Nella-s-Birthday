<script setup lang="ts">
const score = ref(0)
const timeLeft = ref(20)
const hearts = ref<{ id: number; x: number; y: number; size: number }[]>([])
let timer: ReturnType<typeof setInterval> | undefined
let spawnTimer: ReturnType<typeof setInterval> | undefined

function spawnHeart() {
  hearts.value = [
    ...hearts.value,
    {
      id: Date.now() + Math.random(),
      x: 8 + Math.random() * 78,
      y: 12 + Math.random() * 64,
      size: 18 + Math.random() * 24
    }
  ].slice(-12)
}

function startGame() {
  score.value = 0
  timeLeft.value = 20
  hearts.value = []

  if (timer) clearInterval(timer)
  if (spawnTimer) clearInterval(spawnTimer)

  timer = setInterval(() => {
    timeLeft.value = Math.max(0, timeLeft.value - 1)
    if (timeLeft.value <= 0) {
      clearInterval(timer)
      clearInterval(spawnTimer)
    }
  }, 1000)

  spawnTimer = setInterval(() => {
    if (timeLeft.value > 0) spawnHeart()
  }, 500)
}

function tapHeart(id: number) {
  if (timeLeft.value <= 0) return

  const next = hearts.value.filter((heart) => heart.id !== id)
  hearts.value = next
  score.value += 1
}

onMounted(() => {
  startGame()
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  if (spawnTimer) clearInterval(spawnTimer)
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between rounded-2xl border border-pink-200/10 bg-[#140d1c] p-3 text-sm text-pink-100/80">
      <span>Score: {{ score }}</span>
      <span>Temps: {{ timeLeft }}s</span>
    </div>

    <div class="relative h-[280px] overflow-hidden rounded-[28px] border border-pink-200/10 bg-[radial-gradient(circle_at_top,_rgba(255,132,184,0.12),_transparent_52%),linear-gradient(180deg,#120b1d_0%,#1b1027_100%)]">
      <button
        v-for="heart in hearts"
        :key="heart.id"
        type="button"
        class="absolute flex items-center justify-center rounded-full bg-pink-500/10 text-xl text-pink-200 shadow-[0_0_18px_rgba(255,110,168,0.2)] transition hover:scale-110"
        :style="{
          left: `${heart.x}%`,
          top: `${heart.y}%`,
          width: `${heart.size}px`,
          height: `${heart.size}px`
        }"
        @click="tapHeart(heart.id)"
      >
        ❤
      </button>

      <div v-if="timeLeft === 0" class="absolute inset-0 flex items-center justify-center bg-[#120b1d]/80 text-center text-pink-100">
        <div>
          <p class="text-xl font-semibold">Partie terminée</p>
          <p class="mt-2 text-sm text-pink-50/80">Tu as marqué {{ score }} cœur(s).</p>
          <button type="button" class="mt-4 rounded-full bg-pink-500/20 px-3 py-2 text-sm" @click="startGame">
            Rejouer
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
