<script setup lang="ts">
import { AGE } from '../data/config'

const cards = [
  { title: 'Souvenirs', text: 'Une page douce et personnelle pour célébrer les moments les plus précieux.', icon: 'i-lucide-heart' },
  { title: 'Galerie', text: 'Un espace visuel pour admirer les images et vidéos dans une ambiance chaleureuse.', icon: 'i-lucide-images' },
  { title: 'Jeux', text: 'Des mini-jeux ludiques pour ajouter un peu de magie et de surprise.', icon: 'i-lucide-gamepad-2' }
]

useHead({
  title: 'Accueil • Osnella Sènami',
  meta: [{ name: 'description', content: 'Un espace d’anniversaire créé pour Osnella Sènami.' }]
})
</script>

<template>
  <main class="theme-page theme-page--home">
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute left-8 top-12 h-40 w-40 rounded-full bg-pink-200/30 blur-3xl" />
      <div class="absolute right-8 top-20 h-52 w-52 rounded-full bg-violet-200/30 blur-3xl" />
    </div>

    <section class="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pt-20">
      <div class="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p class="mb-4 text-xs font-medium uppercase tracking-[0.35em] text-violet-500">Osnella Sènami</p>
          <p class="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/60 px-3 py-1.5 text-sm font-semibold text-violet-700">
            <UIcon name="i-lucide-cake-slice" class="h-4 w-4" />
            {{ AGE }} ans aujourd’hui
          </p>
          <h1 class="max-w-xl font-[var(--font-display)] text-5xl leading-none text-violet-700 sm:text-6xl lg:text-7xl">
            Un espace fait pour toi.
          </h1>
          <p class="mt-5 max-w-xl text-base leading-8 text-[#5a4967] sm:text-lg">
            Une petite aventure digitale pleine de douceur, de souvenirs et de surprises.
            Navigue entre les pages, découvre les souvenirs, joue un peu et laisse la magie tracer ton chemin.
          </p>

          <div class="mt-8 flex flex-wrap gap-3">
            <NuxtLink
              to="/anniversaire"
              :prefetch-on="{ visibility: false, interaction: true }"
              class="inline-flex items-center gap-2 rounded-full bg-violet-700 px-5 py-3 text-sm font-medium text-white shadow-[0_14px_32px_rgba(109,76,151,0.28)] transition hover:bg-violet-800"
            >
              <UIcon name="i-lucide-heart" class="h-4 w-4" />
              Voir l’anniversaire
            </NuxtLink>
            <NuxtLink
              to="/surprise"
              :prefetch-on="{ visibility: false, interaction: true }"
              class="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/60 px-5 py-3 text-sm font-medium text-violet-700 backdrop-blur-sm transition hover:bg-white/80"
            >
              <UIcon name="i-lucide-gift" class="h-4 w-4" />
              Découvrir la surprise
            </NuxtLink>
            <NuxtLink
              to="/lettres"
              :prefetch-on="{ visibility: false, interaction: true }"
              class="inline-flex items-center gap-2 rounded-full border border-pink-200 bg-white/60 px-5 py-3 text-sm font-medium text-pink-700 transition hover:bg-white/80"
            >
              <UIcon name="i-lucide-spell-check" class="h-4 w-4" />
              Chaque lettre de ton prénom
            </NuxtLink>
            <NuxtLink
              to="/voyage"
              :prefetch-on="{ visibility: false, interaction: true }"
              class="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/60 px-5 py-3 text-sm font-medium text-violet-700 transition hover:bg-white/80"
            >
              <UIcon name="i-lucide-film" class="h-4 w-4" />
              Parcourir les souvenirs
            </NuxtLink>
          </div>
        </div>

        <div class="rounded-[2rem] border border-violet-200/80 bg-white/55 p-6 shadow-[0_24px_80px_rgba(90,55,125,0.12)] backdrop-blur-xl">
          <div class="rounded-[1.6rem] bg-[linear-gradient(135deg,#f9d7ef_0%,#ebdeff_38%,#f6ebff_100%)] p-6">
            <div class="mb-6 flex items-center justify-between text-[10px] uppercase tracking-[0.28em] text-violet-700/80">
              <span>Accueil</span>
              <span>❤</span>
            </div>

            <div class="space-y-4">
              <div class="rounded-2xl bg-white/55 p-4 shadow-inner shadow-violet-200/60">
                <p class="text-3xl font-semibold font-[var(--font-script)] text-violet-800">Osnella Sènami</p>
                <p class="mt-2 text-sm leading-6 text-violet-700/80">
                  Une présence douce, lumineuse et irrésistiblement spéciale.
                </p>
              </div>

              <div class="grid gap-3 sm:grid-cols-3">
                <div class="rounded-2xl bg-white/50 p-3 text-center">
                  <div class="text-lg font-semibold text-violet-700">✨</div>
                  <div class="mt-1 text-[10px] uppercase tracking-[0.2em] text-violet-500/70">Magie</div>
                </div>
                <div class="rounded-2xl bg-white/50 p-3 text-center">
                  <div class="text-lg font-semibold text-violet-700">❤</div>
                  <div class="mt-1 text-[10px] uppercase tracking-[0.2em] text-violet-500/70">Amour</div>
                </div>
                <div class="rounded-2xl bg-white/50 p-3 text-center">
                  <div class="text-lg font-semibold text-violet-700">★</div>
                  <div class="mt-1 text-[10px] uppercase tracking-[0.2em] text-violet-500/70">Lumière</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="relative mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
      <div class="grid gap-4 md:grid-cols-3">
        <article
          v-for="card in cards"
          :key="card.title"
          class="rounded-[1.8rem] border border-violet-200/75 bg-white/50 p-5 shadow-[0_14px_40px_rgba(108,70,150,0.08)] backdrop-blur-sm"
        >
          <div class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
            <UIcon :name="card.icon" class="h-5 w-5" />
          </div>
          <h2 class="text-lg font-semibold text-violet-800">{{ card.title }}</h2>
          <p class="mt-2 text-sm leading-7 text-[#5c4a6b]">{{ card.text }}</p>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped>
.theme-page {
  position: relative;
  overflow: hidden;
  min-height: 100vh;
  background:
    radial-gradient(circle at top, rgba(var(--accent-color-rgb), 0.18), transparent 38%),
    linear-gradient(180deg, var(--bg-color-soft) 0%, color-mix(in srgb, var(--bg-color-soft) 78%, var(--panel-color-solid)) 100%);
  color: var(--text-color);
}

.theme-page--home::before,
.theme-page--home::after {
  content: "";
  position: absolute;
  border-radius: 9999px;
  filter: blur(48px);
  opacity: 0.7;
  pointer-events: none;
}

.theme-page--home::before {
  top: 3rem;
  left: 2rem;
  width: 10rem;
  height: 10rem;
  background: rgba(var(--accent-color-rgb), 0.22);
}

.theme-page--home::after {
  top: 5rem;
  right: 2rem;
  width: 12rem;
  height: 12rem;
  background: rgba(var(--primary-color-rgb), 0.18);
}
</style>
