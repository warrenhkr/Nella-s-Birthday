<script setup lang="ts">
import { getRoleHome } from '~/utils/role-home'

const { success, alert } = useGameToast()
const { playSfx } = useSoundManager()
const { refresh: refreshAuth } = useAuth()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const remember = ref(true)
const isSubmitting = ref(false)
// Message d'erreur affiché DANS la page, en plus du toast : un toast peut
// disparaître avant d'être lu ; l'alerte intégrée reste visible et reste
// annoncée aux lecteurs d'écran (UAlert porte le rôle d'alerte).
const errorMessage = ref('')

function getApiErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = error.data
    if (typeof data === 'object' && data !== null && 'statusMessage' in data && typeof data.statusMessage === 'string') {
      return data.statusMessage
    }
  }

  return fallback
}

async function handleLogin() {
  if (!email.value || !password.value) {
    playSfx('error')
    alert('Merci de remplir l\u2019email et le mot de passe.')
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''

  try {
    const response = await $fetch<{ data: { user: { role: string } } }>('/api/auth/login', {
      method: 'POST',
      body: {
        email: email.value,
        password: password.value
      }
    })

    playSfx('success')
    success('Connexion réussie.')
    // Synchronise l'état d'authentification global (en-tête, navigation)
    // avant la redirection : sans cela, le header gardait l'état « déconnecté »
    // jusqu'au prochain rechargement.
    await refreshAuth()
    // Un administrateur à périmètre est conduit directement dans SON espace
    // (voir shared/admin-scopes.ts) ; les autres rôles ne changent pas.
    const session = useAuth()
    await navigateTo(getRoleHome(
      session.user.value?.role ?? response.data.user.role,
      session.user.value?.adminScopes ?? []
    ))
  } catch (error: unknown) {
    const message = getApiErrorMessage(error, 'Impossible de se connecter avec ces identifiants.')
    errorMessage.value = message
    playSfx('error')
    alert(message)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="auth-page mx-auto w-full max-w-lg px-4 pb-16 pt-10 sm:px-6 sm:pt-16">
    <section class="auth-card surface-solid clip-corner p-5 sm:p-8">
      <span class="auth-card__accent" aria-hidden="true" />

      <header class="auth-head">
        <p class="section-eyebrow">
          Connexion
        </p>
        <h1 class="section-title">
          Accéder au club
        </h1>
        <p class="section-desc">
          Retrouve ton espace membre, la boutique et les tournois avec ton email et ton mot de passe.
        </p>
      </header>

      <UAlert
        v-if="errorMessage"
        class="mt-5"
        color="error"
        variant="soft"
        icon="i-lucide-circle-alert"
        :title="errorMessage"
      />

      <!-- novalidate : la validation métier reste gérée en JavaScript (messages
           français homogènes avec le reste du site), comme avant la refonte. -->
      <form
        class="auth-form mt-6"
        novalidate
        @submit.prevent="handleLogin"
      >
        <UFormField label="Email" required>
          <UInput
            v-model="email"
            class="w-full"
            type="email"
            size="lg"
            icon="i-lucide-mail"
            autocomplete="email"
            placeholder="ton.email@exemple.com"
            aria-label="Adresse email"
          />
        </UFormField>

        <UFormField label="Mot de passe" required>
          <UInput
            v-model="password"
            class="w-full"
            :type="showPassword ? 'text' : 'password'"
            size="lg"
            icon="i-lucide-lock"
            autocomplete="current-password"
            placeholder="Ton mot de passe"
            aria-label="Mot de passe"
          >
            <template #trailing>
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                size="sm"
                :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                :aria-label="showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
                @click="showPassword = !showPassword"
              />
            </template>
          </UInput>
        </UFormField>

        <div class="auth-options">
          <UCheckbox
            v-model="remember"
            label="Rester connecté"
          />
          <NuxtLink to="/inscription" class="auth-link" prefetch>
            Créer un compte
          </NuxtLink>
        </div>

        <UButton
          type="submit"
          color="primary"
          size="lg"
          block
          icon="i-lucide-log-in"
          :loading="isSubmitting"
          :disabled="isSubmitting"
          :label="isSubmitting ? 'Connexion...' : 'Se connecter'"
        />
      </form>

      <div class="auth-foot">
        <span class="auth-foot__item text-muted">
          <UIcon name="i-lucide-shield-check" class="auth-foot__icon" aria-hidden="true" />
          Accès réservé aux membres
        </span>
        <span class="auth-foot__item text-muted">
          <UIcon name="i-lucide-key-round" class="auth-foot__icon" aria-hidden="true" />
          Espace adapté à ton rôle
        </span>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* ---- Panneau : mêmes conventions que boutique.vue / dashboard.vue ---- */
.auth-card {
  position: relative;
  overflow: hidden;
  box-shadow: var(--shadow-glow);
}

/* Fine barre dégradée en tête de carte : rappel de la charte rouge/noir. */
.auth-card__accent {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--primary-color), var(--accent-color));
}

/* ---- Classes maison du système visuel (recopiées à l'identique) ---- */
.section-eyebrow {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--primary-color);
}

.section-title {
  margin-top: 0.35rem;
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 4vw, 2rem);
  font-weight: 900;
  color: var(--text-color);
}

.section-desc {
  margin-top: 0.4rem;
  font-size: 0.875rem;
  color: var(--muted-color);
}

/* ---- Formulaire ---- */
.auth-form {
  display: grid;
  gap: 1.1rem;
}

/* Zones tactiles : au moins 40 px pour TOUS les contrôles du formulaire
   (les tailles Nuxt UI par défaut descendent à 28-36 px). */
.auth-form :deep(input) {
  min-height: 2.75rem;
}

.auth-form :deep([data-slot='trailing'] button) {
  min-width: 2.5rem;
  min-height: 2.5rem;
}

.auth-form :deep(button[type='submit']) {
  min-height: 2.75rem;
}

.auth-options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

/* Case « Rester connecté » : la boîte visible fait 16 px (contrainte du
   thème Nuxt UI), mais le libellé associé est lié au bouton par `for` et
   mesure 44 px de haut : c'est la cible tactile réelle, cliquable. */
.auth-options :deep([data-slot='label']) {
  padding: 0.75rem 0.25rem;
  margin: -0.75rem 0;
  cursor: pointer;
}

.auth-link {
  display: inline-flex;
  align-items: center;
  min-height: 2.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--primary-color);
  text-decoration: none;
}

.auth-link:hover {
  text-decoration: underline;
}

.auth-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem 1.25rem;
  margin-top: 1.75rem;
  padding-top: 1.25rem;
  font-size: 0.75rem;
  border-top: 1px dashed var(--border-color);
}

.auth-foot__item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.auth-foot__icon {
  width: 1rem;
  height: 1rem;
  color: var(--primary-color);
}
</style>
