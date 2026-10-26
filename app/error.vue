<script setup lang="ts">
// ============================================================
// Page d'erreur globale (404, 403, 500…).
//
// Sans ce fichier, Nuxt sert sa page d'erreur par défaut : en anglais, sans
// charte, avec un lien « Home » — incohérent avec le reste du site. Ici, on
// reste dans le thème rouge/noir, en français, avec une sortie claire.
//
// `error` est fourni par Nuxt (useError()). `clearError()` efface l'erreur et
// recharge la destination demandée côté client comme côté serveur.
// ============================================================
const props = defineProps<{ error: { statusCode?: number, statusMessage?: string, message?: string } }>()

const statusCode = computed(() => Number(props.error?.statusCode || 500))
const isNotFound = computed(() => statusCode.value === 404)

const title = computed(() => (isNotFound.value ? 'Page introuvable' : 'Une erreur est survenue'))

const description = computed(() => {
  if (isNotFound.value) {
    return 'Cette page n\'existe pas ou a été déplacée. Vérifie l\'adresse ou reviens à l\'accueil.'
  }
  return 'Le site a rencontré un problème inattendu. Tu peux réessayer ou revenir à l\'accueil.'
})

const codeLabel = computed(() => (Number.isFinite(statusCode.value) ? String(statusCode.value) : '500'))

function goHome() {
  clearError({ redirect: '/' })
}

useHead({
  title: `${codeLabel.value} — ${title.value} | Osnella Sènami`,
  meta: [{ name: 'robots', content: 'noindex' }]
})
</script>

<template>
  <div class="error-shell">
    <div class="error-card surface-solid clip-corner">
      <span
        class="error-icon"
        aria-hidden="true"
      >
        <UIcon
          :name="isNotFound ? 'i-lucide-search-x' : 'i-lucide-triangle-alert'"
        />
      </span>

      <p class="error-code">
        Erreur {{ codeLabel }}
      </p>
      <h1 class="error-title">
        {{ title }}
      </h1>
      <p class="error-text">
        {{ description }}
      </p>

      <div class="error-actions">
        <UButton
          color="primary"
          icon="i-lucide-house"
          label="Revenir à l'accueil"
          @click="goHome"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.error-shell {
  display: flex;
  min-height: 100vh;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  background: var(--bg-color);
}

.error-card {
  display: flex;
  width: 100%;
  max-width: 32rem;
  flex-direction: column;
  align-items: center;
  padding: 2.5rem 1.5rem;
  text-align: center;
}

.error-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  height: 3.5rem;
  font-size: 1.85rem;
  color: var(--primary-color);
  background: rgba(var(--primary-color-rgb), 0.12);
  border: 1px solid rgba(var(--primary-color-rgb), 0.28);
  border-radius: 9999px;
}

.error-code {
  margin-top: 1rem;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--primary-color);
}

.error-title {
  margin-top: 0.35rem;
  font-family: var(--font-display);
  font-size: clamp(1.4rem, 3vw, 1.9rem);
  font-weight: 900;
  color: var(--text-color);
}

.error-text {
  margin-top: 0.5rem;
  max-width: 34rem;
  font-size: 0.9rem;
  color: var(--muted-color);
}

.error-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.6rem;
  margin-top: 1.5rem;
}
</style>
