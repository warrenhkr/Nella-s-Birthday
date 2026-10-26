<script setup lang="ts">
const hearts = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  left: `${8 + (index * 11) % 80}%`,
  delay: `${(index % 5) * 0.5}s`,
  duration: `${6 + (index % 7)}s`
}))

useHead({
  title: 'Surprise • Osnella Sènami',
  meta: [{ name: 'robots', content: 'noindex' }]
})
</script>

<template>
  <main class="theme-page theme-page--surprise px-4 py-10 sm:px-6 lg:px-8">
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        v-for="heart in hearts"
        :key="heart.id"
        class="floating-heart"
        :style="{
          left: heart.left,
          animationDelay: heart.delay,
          animationDuration: heart.duration
        }"
      >
        ❤
      </div>
    </div>

    <div class="relative mx-auto max-w-4xl rounded-[32px] border border-pink-200/15 bg-white/5 p-6 shadow-[0_18px_45px_rgba(0,0,0,0.24)] backdrop-blur-sm sm:p-10">
      <p class="text-[10px] uppercase tracking-[0.32em] text-pink-200/80">Dernière surprise</p>
      <h1 class="mt-4 text-3xl font-semibold text-pink-100 sm:text-5xl">Pour Osnella Sènami</h1>

      <div class="mt-6 space-y-4 text-base leading-8 text-pink-50/85 sm:text-lg">
        <p>Tu as traversé les pages, les algorithmes, les mini-jeux, et chaque détail a été pensé pour te faire sourire.</p>
        <p>Cette petite aventure digitale est un simple rappel : la vraie magie, c’est la présence, la douceur, et les souvenirs qu’on garde.</p>
        <p class="text-pink-100">Merci d’être toi. Joyeux anniversaire, Osnella Sènami.</p>
      </div>

      <div class="mt-8 flex flex-wrap items-center gap-3">
        <NuxtLink
          to="/anniversaire"
          class="inline-flex items-center gap-2 rounded-full bg-pink-500/20 px-4 py-2 text-sm text-pink-100 ring-1 ring-pink-200/20 transition hover:bg-pink-500/30"
        >
          <UIcon name="i-lucide-arrow-left" class="h-4 w-4" />
          Revoir la page principale
        </NuxtLink>

        <NuxtLink
          to="/jeu"
          class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-pink-50 transition hover:bg-white/10"
        >
          <UIcon name="i-lucide-gamepad-2" class="h-4 w-4" />
          Jouer encore
        </NuxtLink>
      </div>
    </div>
  </main>
</template>

<style scoped>
.theme-page {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(circle at top, rgba(var(--accent-color-rgb), 0.18), transparent 46%),
    linear-gradient(180deg, var(--bg-color-soft) 0%, var(--bg-color) 100%);
  color: var(--text-color);
}

.floating-heart {
  position: absolute;
  bottom: -20%;
  font-size: 1.2rem;
  color: rgba(255, 182, 214, 0.9);
  text-shadow: 0 0 18px rgba(255, 110, 168, 0.4);
  animation-name: float-up;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}

@keyframes float-up {
  0% {
    transform: translateY(0) scale(0.9) rotate(0deg);
    opacity: 0;
  }
  15% {
    opacity: 1;
  }
  100% {
    transform: translateY(-120vh) scale(1.2) rotate(12deg);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .floating-heart {
    animation: none;
    opacity: 0.7;
  }
}
</style>
