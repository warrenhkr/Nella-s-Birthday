<script setup lang="ts">
import { BookOpen, BriefcaseBusiness, ChartNoAxesCombined, Gamepad2 } from '@lucide/vue'

useHead({ title: 'Ressources analyste d’entreprise' })

const resources = [
  { title: 'Jeux d’analyse', description: 'Retrouve les jeux de données, indicateurs et méthodes dans la galerie générale.', detail: '12 jeux', to: '/jeu?categorie=analyste', icon: Gamepad2 },
  { title: 'Algorithmes métier', description: 'Prévisions, segmentation, rentabilité et qualité des données, parmi les algorithmes du site.', detail: '12 algorithmes', to: '/algos?categorie=analyste', icon: ChartNoAxesCombined },
  { title: 'Étude de cas', description: 'Explore les chiffres d’Atelier Cannelle et formule des recommandations.', detail: 'Atelier Cannelle', to: '/analyste/etude-de-cas', icon: BriefcaseBusiness },
  { title: 'Glossaire', description: 'Retrouve les définitions et exemples du vocabulaire de l’analyse d’entreprise.', detail: '55 termes', to: '/analyste/glossaire', icon: BookOpen }
]
</script>

<template>
  <main class="theme-page analyst-page min-h-dvh px-4 py-8 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-5xl">
      <header class="mb-8 border-b border-white/10 pb-6">
        <p class="mb-2 text-xs uppercase tracking-[0.28em] text-pink-200/75">Ressources métier</p>
        <h1 class="text-3xl font-semibold text-pink-100 sm:text-4xl">Analyste d’entreprise</h1>
        <p class="mt-3 max-w-2xl text-sm leading-6 text-pink-50/75 sm:text-base">Jeux et algorithmes sont intégrés aux galeries du site. Ici restent l’étude de cas et le glossaire.</p>
      </header>
      <nav aria-label="Ressources analyste" class="grid gap-3 sm:grid-cols-2">
        <NuxtLink v-for="resource in resources" :key="resource.to" :to="resource.to" class="analyst-resource flex min-h-36 items-start gap-4 border p-5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-200">
          <component :is="resource.icon" class="mt-1 h-5 w-5 shrink-0 text-pink-200" aria-hidden="true" />
          <span class="min-w-0">
            <span class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><span class="font-semibold text-white">{{ resource.title }}</span><span class="text-xs text-pink-100/55">{{ resource.detail }}</span></span>
            <span class="mt-2 block text-sm leading-6 text-pink-50/70">{{ resource.description }}</span>
          </span>
        </NuxtLink>
      </nav>
    </div>
  </main>
</template>

<style scoped>
.analyst-resource {
  border-color: var(--border-color);
  border-radius: 6px;
  background: var(--theme-panel);
}

.analyst-resource:hover {
  border-color: color-mix(in srgb, var(--primary-color) 55%, var(--border-color));
  background: var(--theme-panel-solid);
}
</style>
