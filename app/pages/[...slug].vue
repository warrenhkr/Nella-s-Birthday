<script setup lang="ts">
useHead({
  title: 'Page introuvable • Osnella Sènami',
  meta: [{ name: 'robots', content: 'noindex' }]
})
</script>

<template>
  <main class="theme-page theme-page--fallback flex min-h-dvh items-center justify-center px-4 py-8">
    <div class="w-full max-w-xl rounded-[32px] border border-pink-200/15 bg-white/5 p-8 text-center shadow-[0_18px_45px_rgba(0,0,0,0.24)] backdrop-blur-sm">
      <p class="text-[10px] uppercase tracking-[0.32em] text-pink-200/80">Erreur 404</p>
      <h1 class="mt-4 text-3xl font-semibold text-pink-100 sm:text-4xl">Cette page a disparu dans la magie.</h1>
      <p class="mt-4 text-sm leading-7 text-pink-50/80 sm:text-base">
        Le chemin demandé n’existe pas, ou il a été déplacé. Reviens au site principal pour retrouver le parcours prévu.
      </p>

      <div class="mt-6 flex flex-wrap justify-center gap-3">
        <NuxtLink
          to="/anniversaire"
          class="rounded-full bg-pink-500/20 px-4 py-2 text-sm text-pink-100 ring-1 ring-pink-200/20 transition hover:bg-pink-500/30"
        >
          Retour accueil
        </NuxtLink>
        <NuxtLink
          to="/surprise"
          class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-pink-50 transition hover:bg-white/10"
        >
          Voir la surprise
        </NuxtLink>
      </div>
    </div>
  </main>
</template>

<style scoped>
.theme-page {
  background:
    radial-gradient(circle at top, rgba(var(--accent-color-rgb), 0.18), transparent 46%),
    linear-gradient(180deg, var(--bg-color-soft) 0%, var(--bg-color) 100%);
  color: var(--text-color);
}
</style>
