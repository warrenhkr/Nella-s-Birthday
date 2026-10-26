<script setup lang="ts">
import { getRoleHome } from '~/utils/role-home'
import { POLE_LABELS, POLE_SLUGS } from '#shared/poles'

const { success, alert } = useGameToast()
const { playSfx } = useSoundManager()
const { refresh: refreshAuth } = useAuth()

const form = reactive({
  pseudo: '',
  email: '',
  password: '',
  confirmPassword: '',
  pole: 'anime',
  message: '',
  nom: '',
  prenom: '',
  telephone: '',
  situation: 'STUDENT_BENIN',
  pays: '',
  profession: '',
  universite: '',
  faculte: '',
  filiere: ''
})
const formation = computed({
  get: () => ({ universite: form.universite, faculte: form.faculte, filiere: form.filiere }),
  set: (value) => {
    form.universite = value.universite
    form.faculte = value.faculte
    form.filiere = value.filiere
  }
})

// Parcours d'inscription : sert de repère visuel (l'inscription reste un
// formulaire unique validé d'un seul bloc, comme avant la refonte).
const steps = [
  { num: 1, label: 'Identité' },
  { num: 2, label: 'Compte' },
  { num: 3, label: 'Parcours' },
  { num: 4, label: 'Présentation' }
]

// Pôles officiels : source partagée (shared/poles.ts), comme le reste du site.
// À l'inscription on choisit UN pôle principal ; les autres pôles s'ajoutent
// ensuite depuis l'écran de modification de profil (multi-pôles).
const poleOptions = POLE_SLUGS.map(slug => ({ label: POLE_LABELS[slug], value: slug as string }))
const situationOptions = [
  { value: 'STUDENT_BENIN', label: 'Étudiant·e au Bénin' },
  { value: 'STUDENT_ABROAD', label: 'Étudiant·e à l’étranger' },
  { value: 'PROFESSIONAL', label: 'Je ne suis plus à l’université' }
]

const isSubmitting = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)
// Erreur affichée dans la page en complément du toast (le toast peut passer
// inaperçu ; l'alerte intégrée est annoncée aux lecteurs d'écran).
const errorMessage = ref('')

function getApiErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = error.data
    if (typeof data === 'object' && data !== null && 'statusMessage' in data && typeof data.statusMessage === 'string') {
      if (data.statusMessage !== 'Validation error') return data.statusMessage
    }
    if (typeof data === 'object' && data !== null && 'data' in data) {
      const details = data.data
      if (typeof details === 'object' && details !== null && 'fieldErrors' in details) {
        const fieldErrors = details.fieldErrors
        if (typeof fieldErrors === 'object' && fieldErrors !== null) {
          const firstError = Object.values(fieldErrors).find(value => Array.isArray(value) && value.length > 0)
          if (Array.isArray(firstError) && typeof firstError[0] === 'string') return firstError[0]
        }
      }
    }
  }

  return fallback
}

async function handleSubmit() {
  const pseudo = form.pseudo.trim()
  const email = form.email.trim()
  const message = form.message.trim()

  const parcoursInvalide = form.situation === 'STUDENT_BENIN'
    ? form.universite.trim().length < 2 || form.filiere.trim().length < 2
    : form.situation === 'STUDENT_ABROAD'
      ? form.pays.trim().length < 2 || form.universite.trim().length < 2 || form.filiere.trim().length < 2
      : form.profession.trim().length < 2

  if (!pseudo || !email || !form.password || !form.nom.trim() || !form.prenom.trim() || form.telephone.trim().length < 6 || parcoursInvalide) {
    playSfx('error')
    alert('Complète ton identité et les informations correspondant à ta situation.')
    return
  }

  if (pseudo.length < 3 || pseudo.length > 20) {
    playSfx('error')
    alert('Le pseudo doit contenir entre 3 et 20 caractères.')
    return
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    playSfx('error')
    alert('Email invalide.')
    return
  }

  if (form.password.length < 8) {
    playSfx('error')
    alert('Le mot de passe doit avoir au moins 8 caractères.')
    return
  }

  if (form.password !== form.confirmPassword) {
    playSfx('error')
    alert('Les mots de passe ne correspondent pas.')
    return
  }

  if (message.length > 500) {
    playSfx('error')
    alert('La présentation ne doit pas dépasser 500 caractères.')
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''

  try {
    const response = await $fetch<{ data: { user: { role: string } } }>('/api/auth/signup', {
      method: 'POST',
      body: {
        pseudo,
        email,
        password: form.password,
        pole: form.pole,
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        telephone: form.telephone.trim(),
        situation: form.situation,
        pays: form.situation === 'STUDENT_ABROAD' ? form.pays.trim() : undefined,
        profession: form.situation === 'PROFESSIONAL' ? form.profession.trim() : undefined,
        universite: form.situation === 'PROFESSIONAL' ? undefined : form.universite.trim(),
        faculte: form.situation === 'STUDENT_BENIN' ? form.faculte : undefined,
        filiere: form.situation === 'PROFESSIONAL' ? undefined : form.filiere.trim(),
        bio: message || undefined
      }
    })

    playSfx('success')
    success(`Bienvenue ${form.pseudo} ! Ton inscription a bien été enregistrée.`)
    // Met à jour l'état d'authentification global avant la redirection.
    await refreshAuth()
    // Un administrateur à périmètre est conduit directement dans SON espace
    // (voir shared/admin-scopes.ts) ; les autres rôles ne changent pas.
    const session = useAuth()
    await navigateTo(getRoleHome(
      session.user.value?.role ?? response.data.user.role,
      session.user.value?.adminScopes ?? []
    ))
  } catch (error: unknown) {
    const message = getApiErrorMessage(error, 'Impossible de finaliser l’inscription.')
    errorMessage.value = message
    playSfx('error')
    alert(message)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="reg-page mx-auto w-full max-w-3xl px-4 pb-16 pt-10 sm:px-6 sm:pt-16">
    <header class="reg-head">
      <p class="section-eyebrow">
        Rejoindre
      </p>
      <h1 class="section-title">
        Inscription au Club Otaku
      </h1>
      <p class="section-desc">
        Crée ton compte membre en quelques minutes : identité, compte, formation puis une courte présentation.
      </p>
    </header>

    <!-- Repère de progression : purement visuel (formulaire unique). -->
    <ol class="reg-steps mt-6">
      <li
        v-for="step in steps"
        :key="step.num"
        class="reg-steps__item"
      >
        <span class="reg-steps__num">{{ step.num }}</span>
        <span class="reg-steps__label hidden sm:inline">{{ step.label }}</span>
      </li>
    </ol>

    <div class="reg-card surface-solid clip-corner mt-5 p-5 sm:p-8">
      <UAlert
        v-if="errorMessage"
        class="mb-5"
        color="error"
        variant="soft"
        icon="i-lucide-circle-alert"
        :title="errorMessage"
      />

      <!-- novalidate : validation métier inchangée, gérée en JavaScript. -->
      <form
        class="reg-form"
        novalidate
        @submit.prevent="handleSubmit"
      >
        <!-- Étape 1 : identité -->
        <section class="reg-section">
          <p class="section-eyebrow">
            <UIcon
              name="i-lucide-user-round"
              class="reg-section__icon"
              aria-hidden="true"
            />
            Étape 1
          </p>
          <h2 class="section-title section-title--sub">
            Ton identité
          </h2>
          <p class="section-desc">
            Ces informations servent à la fiche membre du club.
          </p>

          <div class="reg-fields reg-fields--pair mt-4">
            <UFormField
              label="Prénom"
              required
            >
              <UInput
                v-model="form.prenom"
                class="registration-control w-full"
                autocomplete="given-name"
                placeholder="Ton prénom"
                aria-label="Prénom"
              />
            </UFormField>
            <UFormField
              label="Nom"
              required
            >
              <UInput
                v-model="form.nom"
                class="registration-control w-full"
                autocomplete="family-name"
                placeholder="Ton nom"
                aria-label="Nom"
              />
            </UFormField>
            <UFormField
              label="Téléphone"
              required
            >
              <UInput
                v-model="form.telephone"
                class="registration-control w-full"
                type="tel"
                icon="i-lucide-phone"
                autocomplete="tel"
                placeholder="Ex. 01 23 45 67 89"
                aria-label="Numéro de téléphone"
              />
            </UFormField>
          </div>
        </section>

        <!-- Étape 2 : compte -->
        <section class="reg-section">
          <p class="section-eyebrow">
            <UIcon
              name="i-lucide-key-round"
              class="reg-section__icon"
              aria-hidden="true"
            />
            Étape 2
          </p>
          <h2 class="section-title section-title--sub">
            Ton compte
          </h2>
          <p class="section-desc">
            Le pseudo apparaîtra publiquement ; l’email reste privé et sert à te connecter.
          </p>

          <div class="reg-fields reg-fields--pair mt-4">
            <UFormField
              label="Pseudo"
              required
              hint="3 à 20 caractères"
            >
              <UInput
                v-model="form.pseudo"
                class="registration-control w-full"
                autocomplete="username"
                placeholder="Ton pseudo de membre"
                aria-label="Pseudo"
              />
            </UFormField>
            <UFormField
              label="Email"
              required
            >
              <UInput
                v-model="form.email"
                class="registration-control w-full"
                type="email"
                icon="i-lucide-mail"
                autocomplete="email"
                placeholder="ton.email@exemple.com"
                aria-label="Adresse email"
              />
            </UFormField>
            <UFormField
              label="Mot de passe"
              required
              hint="8 caractères minimum"
            >
              <UInput
                v-model="form.password"
                class="registration-control w-full"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="new-password"
                placeholder="Choisis un mot de passe"
                aria-label="Mot de passe"
              >
                <template #trailing>
                  <UButton
                    type="button"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                    :aria-label="showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
                    @click="showPassword = !showPassword"
                  />
                </template>
              </UInput>
            </UFormField>
            <UFormField
              label="Confirmation du mot de passe"
              required
            >
              <UInput
                v-model="form.confirmPassword"
                class="registration-control w-full"
                :type="showConfirmPassword ? 'text' : 'password'"
                autocomplete="new-password"
                placeholder="Répète le mot de passe"
                aria-label="Confirmation du mot de passe"
              >
                <template #trailing>
                  <UButton
                    type="button"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    :icon="showConfirmPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                    :aria-label="showConfirmPassword ? 'Masquer la confirmation du mot de passe' : 'Afficher la confirmation du mot de passe'"
                    @click="showConfirmPassword = !showConfirmPassword"
                  />
                </template>
              </UInput>
            </UFormField>
          </div>
        </section>

        <!-- Étape 3 : parcours et pôle -->
        <section class="reg-section">
          <p class="section-eyebrow">
            <UIcon
              name="i-lucide-graduation-cap"
              class="reg-section__icon"
              aria-hidden="true"
            />
            Étape 3
          </p>
          <h2 class="section-title section-title--sub">
            Parcours et pôle
          </h2>
          <p class="section-desc">
            Indique ton parcours actuel, puis le pôle qui t’intéresse le plus.
          </p>

          <div class="reg-fields mt-4">
            <AppSelect
              v-model="form.situation"
              class="registration-control"
              label="Ta situation actuelle"
              icon="i-lucide-user-round"
              :options="situationOptions"
            />
            <div
              v-if="form.situation === 'STUDENT_BENIN'"
              class="registration-control"
            >
              <FiliereSelect v-model="formation" />
            </div>
            <template v-else-if="form.situation === 'STUDENT_ABROAD'">
              <UFormField
                label="Pays"
                required
              >
                <UInput
                  v-model="form.pays"
                  class="registration-control w-full"
                  autocomplete="country-name"
                  placeholder="Ex. Sénégal"
                />
              </UFormField>
              <UFormField
                label="Université ou établissement"
                required
              >
                <UInput
                  v-model="form.universite"
                  class="registration-control w-full"
                  placeholder="Nom de ton université ou école"
                />
              </UFormField>
              <UFormField
                label="Filière"
                required
              >
                <UInput
                  v-model="form.filiere"
                  class="registration-control w-full"
                  placeholder="Écris le nom de ta filière"
                />
              </UFormField>
            </template>
            <UFormField
              v-else
              label="Profession ou activité actuelle"
              required
            >
              <UInput
                v-model="form.profession"
                class="registration-control w-full"
                placeholder="Ex. graphiste, entrepreneuse, en recherche d’emploi"
              />
            </UFormField>
            <AppSelect
              v-model="form.pole"
              class="registration-control"
              label="Pôle principal"
              icon="i-lucide-users"
              aria-label="Pôle"
              :options="poleOptions"
            />
          </div>
          <p class="section-desc mt-3">
            Ce pôle est ton pôle principal. Tu pourras en ajouter d'autres
            (jusqu'aux 6 pôles du club) depuis « Mon profil » après ton
            inscription.
          </p>
        </section>

        <!-- Étape 4 : présentation -->
        <section class="reg-section">
          <p class="section-eyebrow">
            <UIcon
              name="i-lucide-pen-line"
              class="reg-section__icon"
              aria-hidden="true"
            />
            Étape 4
          </p>
          <h2 class="section-title section-title--sub">
            Ta présentation
          </h2>
          <p class="section-desc">
            Facultatif : quelques mots sur toi, tes animés ou mangas préférés.
          </p>

          <div class="reg-fields mt-4">
            <UFormField
              label="Présentation"
              hint="Facultatif, 500 caractères maximum"
            >
              <UTextarea
                v-model="form.message"
                class="registration-control w-full"
                :rows="4"
                placeholder="Présente-toi en quelques mots"
                aria-label="Présentation"
              />
            </UFormField>
            <p
              class="reg-counter"
              :class="{ 'reg-counter--over': form.message.length > 500 }"
            >
              {{ form.message.length }}/500 caractères
            </p>
          </div>
        </section>

        <div class="reg-actions">
          <p class="text-muted">
            Tous les champs marqués d’un astérisque sont obligatoires.
          </p>
          <UButton
            type="submit"
            color="primary"
            size="lg"
            block
            icon="i-lucide-user-plus"
            :loading="isSubmitting"
            :disabled="isSubmitting"
            :label="isSubmitting ? 'Enregistrement...' : 'Valider l\u2019inscription'"
          />
        </div>
      </form>
    </div>

    <p class="reg-foot text-muted">
      Déjà membre ?
      <NuxtLink
        to="/auth"
        class="auth-link"
        prefetch
      >
        Se connecter
      </NuxtLink>
    </p>
  </div>
</template>

<style scoped>
/* ---- Classes maison du système visuel (recopiées à l'identique) ---- */
.section-eyebrow {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--primary-color);
}

.section-title {
  margin-top: 0.35rem;
  font-family: var(--font-display);
  font-size: clamp(1.6rem, 3vw, 2.25rem);
  font-weight: 900;
  color: var(--text-color);
}

.section-title--sub {
  font-size: clamp(1.2rem, 2.3vw, 1.5rem);
  font-weight: 800;
}

.section-desc {
  margin-top: 0.35rem;
  max-width: 62ch;
  font-size: 0.875rem;
  color: var(--muted-color);
}

.section-eyebrow .reg-section__icon {
  width: 0.95rem;
  height: 0.95rem;
}

/* ---- Repère de progression : flex-wrap, jamais de débordement à 375 px ---- */
.reg-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
}

.reg-steps__item {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.75rem;
  color: var(--muted-color);
}

.reg-steps__num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--primary-color);
  background: rgba(var(--primary-color-rgb), 0.12);
  border: 1px solid rgba(var(--primary-color-rgb), 0.28);
  border-radius: 9999px;
}

/* ---- Formulaire ---- */
.reg-form {
  display: grid;
  gap: 0.25rem;
}

.reg-section {
  padding: 1.25rem 0;
  border-top: 1px dashed var(--border-color);
}

.reg-section:first-of-type {
  padding-top: 0;
  border-top: 0;
}

.reg-fields {
  display: grid;
  gap: 1rem;
  min-width: 0;
}

/* Deux colonnes uniquement à partir des tablettes : à 375 px, une seule. */
@media (min-width: 640px) {
  .reg-fields--pair {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.reg-counter {
  margin-top: -0.5rem;
  font-size: 0.75rem;
  text-align: right;
  color: var(--muted-color);
}

.reg-counter--over {
  font-weight: 700;
  color: var(--primary-color);
}

.reg-actions {
  display: grid;
  gap: 0.9rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px dashed var(--border-color);
}

.reg-actions p {
  font-size: 0.8rem;
}

.reg-foot {
  margin-top: 1.25rem;
  font-size: 0.875rem;
  text-align: center;
}

.auth-link {
  display: inline-flex;
  align-items: center;
  min-height: 2.5rem;
  font-weight: 600;
  color: var(--primary-color);
  text-decoration: none;
}

.auth-link:hover {
  text-decoration: underline;
}

/* Contrôles : mêmes tokens de thème que le reste du site (rouge/noir). */
:deep(.registration-control [data-slot='base']),
:deep(.registration-control [data-slot='trigger']),
:deep(.registration-control input),
:deep(.registration-control textarea),
:deep(.registration-control .app-select__native) {
  width: 100%;
  min-height: 2.75rem;
  border-color: var(--border-color) !important;
  background-color: rgba(var(--primary-color-rgb), 0.06) !important;
  color: var(--text-color) !important;
}

:deep(.registration-control [data-slot='base']:focus-within),
:deep(.registration-control [data-slot='trigger']:focus),
:deep(.registration-control input:focus),
:deep(.registration-control textarea:focus),
:deep(.registration-control .app-select__native:focus-visible) {
  border-color: var(--primary-color) !important;
  box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.14) !important;
}

/* Bouton œil : largeur minimale pour rester une cible tactile confortable. */
:deep(.registration-control [data-slot='trailing'] button) {
  min-width: 2.5rem;
  min-height: 2.5rem;
}

/* Bouton de validation : >= 44 px de haut (taille lg Nuxt UI = 36 px). */
.reg-actions :deep(button[type='submit']) {
  min-height: 2.75rem;
}
</style>
