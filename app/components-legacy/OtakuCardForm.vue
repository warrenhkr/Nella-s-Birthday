<script setup lang="ts">
// ============================================================
// OtakuCardForm — création / mise à jour de la carte Otaku.
//
// Le formulaire gère l’identité du membre, son parcours actuel et son univers
// otaku avant l’envoi à l’API de carte.
// ============================================================

type OtakuCard = {
  id: string
  displayName: string
  imageUrl: string | null
  favoriteAnime: string | null
  favoriteManga: string | null
  favoriteAnimes: string[]
  favoriteMangas: string[]
  favoriteGame: string | null
  bio: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
}

type MemberSituation = 'STUDENT_BENIN' | 'STUDENT_ABROAD' | 'PROFESSIONAL'

const props = defineProps<{
  card: OtakuCard | null
  registrationInfo: {
    nom: string | null
    prenom: string | null
    telephone: string | null
    situation: MemberSituation | null
    pays: string | null
    profession: string | null
    universite: string | null
    faculte: string | null
    filiere: string | null
  } | null
}>()

const emit = defineEmits<{
  saved: [card: OtakuCard]
}>()

const { success, alert } = useGameToast()
const { refresh: refreshAuth } = useAuth()
const { uploadImage } = useCloudinaryUpload()
const displayName = ref(props.card?.displayName || '')
const imageUrl = ref(props.card?.imageUrl || '')
const favoriteAnimes = ref<string[]>(props.card?.favoriteAnimes || (props.card?.favoriteAnime ? [props.card.favoriteAnime] : []))
const favoriteMangas = ref<string[]>(props.card?.favoriteMangas || (props.card?.favoriteManga ? [props.card.favoriteManga] : []))
const favoriteGame = ref(props.card?.favoriteGame || '')
const bio = ref(props.card?.bio || '')
const situation = ref<MemberSituation>(props.registrationInfo?.situation || (props.registrationInfo?.profession ? 'PROFESSIONAL' : 'STUDENT_BENIN'))
const pays = ref(props.registrationInfo?.pays || '')
const profession = ref(props.registrationInfo?.profession || '')
const situationOptions = [
  { value: 'STUDENT_BENIN', label: 'Étudiant·e au Bénin' },
  { value: 'STUDENT_ABROAD', label: 'Étudiant·e à l’étranger' },
  { value: 'PROFESSIONAL', label: 'Je ne suis plus à l’université' }
]
const registration = reactive({
  nom: props.registrationInfo?.nom || '',
  prenom: props.registrationInfo?.prenom || '',
  telephone: props.registrationInfo?.telephone || '',
  universite: props.registrationInfo?.universite || '',
  faculte: props.registrationInfo?.faculte || '',
  filiere: props.registrationInfo?.filiere || ''
})

function updateRegistration(value: { universite: string, faculte: string, filiere: string }) {
  Object.assign(registration, value)
}

const submitting = ref(false)
const imagePending = ref(false)
const imageInput = ref<HTMLInputElement | null>(null)

const statutLabels: Record<OtakuCard['status'], string> = {
  PENDING: 'En attente de validation',
  APPROVED: 'Carte validée',
  REJECTED: 'À corriger'
}

const statutLabel = computed(() => props.card ? statutLabels[props.card.status] : null)
const situationDetails = computed(() => {
  if (situation.value === 'PROFESSIONAL') return profession.value.trim() ? `Profession · ${profession.value.trim()}` : ''
  if (situation.value === 'STUDENT_ABROAD') {
    const details = [pays.value, registration.universite, registration.filiere].map(value => value.trim()).filter(Boolean)
    return details.length ? `Étudiant·e à l’étranger · ${details.join(' · ')}` : ''
  }
  const details = [registration.universite, registration.faculte, registration.filiere].map(value => value.trim()).filter(Boolean)
  return details.length ? `Étudiant·e au Bénin · ${details.join(' · ')}` : ''
})

const statutCouleur = computed<'primary' | 'success' | 'error'>(() => {
  if (props.card?.status === 'APPROVED') return 'success'
  if (props.card?.status === 'REJECTED') return 'error'
  return 'primary'
})

watch(() => props.card, (card) => {
  displayName.value = card?.displayName || ''
  imageUrl.value = card?.imageUrl || ''
  favoriteAnimes.value = card?.favoriteAnimes || (card?.favoriteAnime ? [card.favoriteAnime] : [])
  favoriteMangas.value = card?.favoriteMangas || (card?.favoriteManga ? [card.favoriteManga] : [])
  favoriteGame.value = card?.favoriteGame || ''
  bio.value = card?.bio || ''
})
watch(() => props.registrationInfo, (value) => {
  if (!value) return
  registration.nom = value.nom || ''
  registration.prenom = value.prenom || ''
  registration.telephone = value.telephone || ''
  situation.value = value.situation || (value.profession ? 'PROFESSIONAL' : 'STUDENT_BENIN')
  pays.value = value.pays || ''
  profession.value = value.profession || ''
  registration.universite = value.universite || ''
  registration.faculte = value.faculte || ''
  registration.filiere = value.filiere || ''
}, { deep: true })

function addFavorite(list: string[]) {
  list.push('')
}

function removeFavorite(list: string[], index: number) {
  list.splice(index, 1)
}

async function uploadCardImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  imagePending.value = true
  try {
    imageUrl.value = (await uploadImage(file)).url
  } catch {
    alert('Impossible de téléverser cette image.')
  } finally {
    imagePending.value = false
    input.value = ''
  }
}

async function saveCard() {
  const formationInvalide = situation.value === 'STUDENT_BENIN'
    ? registration.universite.trim().length < 2 || registration.filiere.trim().length < 2
    : situation.value === 'STUDENT_ABROAD'
      ? pays.value.trim().length < 2 || registration.universite.trim().length < 2 || registration.filiere.trim().length < 2
      : profession.value.trim().length < 2

  if (
    displayName.value.trim().length < 2
    || registration.nom.trim().length < 2
    || registration.prenom.trim().length < 2
    || registration.telephone.trim().length < 6
    || formationInvalide
  ) {
    alert('Complète ton identité et les informations correspondant à ta situation avant de créer ta carte Otaku.')
    return
  }

  submitting.value = true
  try {
    const response = await $fetch<{ data: OtakuCard }>('/api/member/card', {
      method: 'POST',
      body: {
        displayName: displayName.value.trim(),
        ...registration,
        situation: situation.value,
        pays: situation.value === 'STUDENT_ABROAD' ? pays.value.trim() : undefined,
        profession: situation.value === 'PROFESSIONAL' ? profession.value.trim() : undefined,
        universite: situation.value === 'PROFESSIONAL' ? undefined : registration.universite.trim(),
        faculte: situation.value === 'STUDENT_BENIN' ? registration.faculte : undefined,
        filiere: situation.value === 'PROFESSIONAL' ? undefined : registration.filiere.trim(),
        imageUrl: imageUrl.value || undefined,
        favoriteAnimes: favoriteAnimes.value.map(item => item.trim()).filter(Boolean),
        favoriteMangas: favoriteMangas.value.map(item => item.trim()).filter(Boolean),
        favoriteGame: favoriteGame.value.trim() || undefined,
        bio: bio.value.trim() || undefined
      }
    })
    emit('saved', response.data)
    await refreshAuth()
    success('Carte Otaku envoyée pour validation.')
  } catch {
    alert('Impossible d’enregistrer ta carte Otaku.')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <form
    class="carte-form surface-solid clip-corner"
    @submit.prevent="saveCard"
  >
    <header class="carte-form__entete">
      <div class="min-w-0">
        <p class="section-eyebrow">
          Identité club
        </p>
        <h2 class="section-title--sub">
          Ma carte Otaku
        </h2>
        <p class="section-desc">
          Trois minutes pour créer ta carte de membre. Ton identité et ta
          formation sont obligatoires, le reste est libre.
        </p>
      </div>
      <UBadge
        v-if="statutLabel"
        class="carte-form__statut"
        :color="statutCouleur"
        variant="soft"
      >
        {{ statutLabel }}
      </UBadge>
    </header>

    <section class="carte-form__bloc">
      <h3 class="carte-form__titre">
        <UIcon
          name="i-lucide-image-plus"
          aria-hidden="true"
        />
        Photo &amp; aperçu
      </h3>
      <div class="carte-form__photo">
        <div class="carte-form__apercu-photo">
          <img
            v-if="imageUrl"
            :src="imageUrl"
            alt="Aperçu de la photo de la carte"
          >
          <span v-else>{{ displayName.slice(0, 1).toUpperCase() || '?' }}</span>
        </div>
        <div class="min-w-0">
          <p class="carte-form__aide">
            Un portrait, un avatar ou le symbole qui te représente : il
            apparaîtra en grand sur ta carte.
          </p>
          <input
            ref="imageInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="sr-only"
            @change="uploadCardImage"
          >
          <UButton
            class="carte-form__photo-bouton"
            color="neutral"
            variant="soft"
            icon="i-lucide-image-plus"
            :loading="imagePending"
            label="Ajouter une photo ou un symbole"
            @click="imageInput?.click()"
          />
        </div>
      </div>
    </section>

    <section class="carte-form__bloc">
      <h3 class="carte-form__titre">
        <UIcon
          name="i-lucide-badge-check"
          aria-hidden="true"
        />
        Identité &amp; formation
      </h3>
      <div class="carte-form__grille">
        <div class="champ">
          <label
            class="champ__label"
            for="carte-nom"
          >
            Nom <span aria-hidden="true">*</span>
          </label>
          <UInput
            id="carte-nom"
            v-model="registration.nom"
            placeholder="Nom de famille"
            autocomplete="family-name"
          />
        </div>
        <div class="champ">
          <label
            class="champ__label"
            for="carte-prenom"
          >
            Prénom <span aria-hidden="true">*</span>
          </label>
          <UInput
            id="carte-prenom"
            v-model="registration.prenom"
            placeholder="Prénom"
            autocomplete="given-name"
          />
        </div>
        <div class="champ champ--large">
          <label
            class="champ__label"
            for="carte-telephone"
          >
            Numéro de téléphone <span aria-hidden="true">*</span>
          </label>
          <UInput
            id="carte-telephone"
            v-model="registration.telephone"
            placeholder="Ex. 01 97 00 00 00"
            type="tel"
            autocomplete="tel"
          />
        </div>
      </div>
      <AppSelect
        v-model="situation"
        class="carte-form__filiere"
        label="Ta situation actuelle"
        icon="i-lucide-user-round"
        :options="situationOptions"
      />
      <FiliereSelect
        v-if="situation === 'STUDENT_BENIN'"
        :model-value="registration"
        class="carte-form__filiere"
        @update:model-value="updateRegistration"
      />
      <div
        v-else-if="situation === 'STUDENT_ABROAD'"
        class="carte-form__grille"
      >
        <div class="champ">
          <label
            class="champ__label"
            for="carte-pays"
          >Pays <span aria-hidden="true">*</span></label>
          <UInput
            id="carte-pays"
            v-model="pays"
            autocomplete="country-name"
            placeholder="Ex. Sénégal"
          />
        </div>
        <div class="champ">
          <label
            class="champ__label"
            for="carte-etablissement"
          >Établissement <span aria-hidden="true">*</span></label>
          <UInput
            id="carte-etablissement"
            v-model="registration.universite"
            placeholder="Nom de ton université ou école"
          />
        </div>
        <div class="champ champ--large">
          <label
            class="champ__label"
            for="carte-filiere-libre"
          >Filière <span aria-hidden="true">*</span></label>
          <UInput
            id="carte-filiere-libre"
            v-model="registration.filiere"
            placeholder="Écris le nom de ta filière"
          />
        </div>
      </div>
      <div
        v-else
        class="champ"
      >
        <label
          class="champ__label"
          for="carte-profession"
        >Profession ou activité actuelle <span aria-hidden="true">*</span></label>
        <UInput
          id="carte-profession"
          v-model="profession"
          placeholder="Ex. graphiste, entrepreneuse, en recherche d’emploi"
        />
      </div>
      <div class="champ">
        <label
          class="champ__label"
          for="carte-display"
        >
          Nom affiché sur la carte <span aria-hidden="true">*</span>
        </label>
        <UInput
          id="carte-display"
          v-model="displayName"
          placeholder="Ton pseudo otaku, celui que tout le club verra"
        />
      </div>
    </section>

    <section class="carte-form__bloc">
      <h3 class="carte-form__titre">
        <UIcon
          name="i-lucide-sparkles"
          aria-hidden="true"
        />
        Univers otaku
      </h3>
      <div class="champ">
        <label
          class="champ__label"
          for="carte-jeu"
        >
          Jeu favori
        </label>
        <UInput
          id="carte-jeu"
          v-model="favoriteGame"
          placeholder="Ex. Genshin Impact"
        />
      </div>

      <div class="carte-form__liste">
        <div class="carte-form__liste-entete">
          <span>Animes favoris</span>
          <UButton
            size="xs"
            color="neutral"
            variant="soft"
            label="+ Ajouter"
            @click="addFavorite(favoriteAnimes)"
          />
        </div>
        <p
          v-if="favoriteAnimes.length === 0"
          class="carte-form__aide"
        >
          Aucun anime pour l’instant : ajoute-en jusqu’à 12.
        </p>
        <div
          v-for="(_, index) in favoriteAnimes"
          :key="`anime-${index}`"
          class="carte-form__ligne"
        >
          <UInput
            v-model="favoriteAnimes[index]"
            placeholder="Ex. One Piece"
            class="flex-1"
          />
          <UButton
            size="xs"
            color="error"
            variant="ghost"
            icon="i-lucide-x"
            aria-label="Supprimer cet anime"
            @click="removeFavorite(favoriteAnimes, index)"
          />
        </div>
      </div>

      <div class="carte-form__liste">
        <div class="carte-form__liste-entete">
          <span>Mangas favoris</span>
          <UButton
            size="xs"
            color="neutral"
            variant="soft"
            label="+ Ajouter"
            @click="addFavorite(favoriteMangas)"
          />
        </div>
        <p
          v-if="favoriteMangas.length === 0"
          class="carte-form__aide"
        >
          Aucun manga pour l’instant : ajoute-en jusqu’à 12.
        </p>
        <div
          v-for="(_, index) in favoriteMangas"
          :key="`manga-${index}`"
          class="carte-form__ligne"
        >
          <UInput
            v-model="favoriteMangas[index]"
            placeholder="Ex. Berserk"
            class="flex-1"
          />
          <UButton
            size="xs"
            color="error"
            variant="ghost"
            icon="i-lucide-x"
            aria-label="Supprimer ce manga"
            @click="removeFavorite(favoriteMangas, index)"
          />
        </div>
      </div>

      <div class="champ">
        <label
          class="champ__label"
          for="carte-bio"
        >
          Quelques mots sur ton univers otaku
        </label>
        <UTextarea
          id="carte-bio"
          v-model="bio"
          placeholder="Ex. Chasseur de shonen le week-end, collectionneur de figurines."
        />
      </div>
    </section>

    <section class="carte-form__bloc carte-form__bloc--apercu">
      <h3 class="carte-form__titre">
        <UIcon
          name="i-lucide-id-card"
          aria-hidden="true"
        />
        Aperçu de ta carte
      </h3>
      <div class="apercu">
        <div class="apercu__photo">
          <img
            v-if="imageUrl"
            :src="imageUrl"
            alt=""
          >
          <span v-else>{{ displayName.slice(0, 1).toUpperCase() || '?' }}</span>
        </div>
        <div class="min-w-0">
          <p class="apercu__eyebrow">
            Club Otaku ENEAM
          </p>
          <p class="apercu__pseudo">
            {{ displayName || 'Ton pseudo otaku' }}
          </p>
          <p
            v-if="registration.nom || registration.prenom"
            class="apercu__nom"
          >
            {{ [registration.prenom, registration.nom].filter(Boolean).join(' ') }}
          </p>
          <p
            v-if="situationDetails"
            class="apercu__ligne"
          >
            {{ situationDetails }}
          </p>
          <p class="apercu__ligne">
            {{ favoriteAnimes.filter(Boolean).join(' · ') || 'Tes animes favoris' }}
          </p>
          <p class="apercu__ligne">
            {{ favoriteMangas.filter(Boolean).join(' · ') || 'Tes mangas favoris' }}
          </p>
          <p
            v-if="bio"
            class="apercu__bio"
          >
            {{ bio }}
          </p>
        </div>
      </div>
    </section>

    <div class="carte-form__pied">
      <UButton
        type="submit"
        color="primary"
        icon="i-lucide-clipboard-check"
        :loading="submitting"
        label="Enregistrer ma carte"
      />
      <p class="carte-form__aide">
        Ta carte passe en validation par l’équipe du club avant d’être visible.
      </p>
    </div>
  </form>
</template>

<style scoped>
.carte-form {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
  min-width: 0;
  padding: clamp(1.1rem, 3.5vw, 1.75rem);
  box-shadow: inset 3px 0 0 var(--primary-color);
}

.carte-form__entete {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.carte-form__statut {
  flex: 0 0 auto;
}

.carte-form__bloc {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  min-width: 0;
  padding-top: 1.1rem;
  border-top: 1px dashed var(--border-color);
}

.carte-form__bloc:first-of-type {
  padding-top: 0;
  border-top: none;
}

.carte-form__titre {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: var(--text-color);
}

.carte-form__titre :deep(svg) {
  width: 1.05rem;
  height: 1.05rem;
  color: var(--primary-color);
}

.carte-form__photo {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  min-width: 0;
}

.carte-form__apercu-photo {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 7.5rem;
  height: 7.5rem;
  overflow: hidden;
  border: 2px solid var(--primary-color);
  border-radius: 1.15rem;
  color: var(--bg-color);
  background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
  font-family: var(--font-display);
  font-size: 2.6rem;
  font-weight: 900;
}

.carte-form__apercu-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.carte-form__photo-bouton {
  margin-top: 0.75rem;
}

.carte-form__grille {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.85rem;
}

.carte-form__filiere {
  margin-top: 0.15rem;
}

.carte-form__liste {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}

.carte-form__liste-entete {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-color);
}

.carte-form__ligne {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.carte-form__aide {
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--muted-color);
}

.carte-form__pied {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  padding-top: 1.1rem;
  border-top: 1px solid var(--border-color);
}

.carte-form__pied .carte-form__aide {
  flex: 1 1 14rem;
  min-width: 0;
}

.champ {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.champ__label {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--text-color);
}

.champ__label span {
  color: var(--primary-color);
}

/* Cibles tactiles confortables (>= 44 px) sur les actions du formulaire. */
.carte-form :deep(button),
.carte-form :deep(input:not([type="checkbox"])) {
  min-height: 2.75rem;
}

.carte-form__liste-entete :deep(button),
.carte-form__ligne :deep(button) {
  min-height: 2.25rem;
}

.apercu {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  min-width: 0;
  padding: 1rem;
  border: 1px solid rgba(var(--primary-color-rgb), 0.35);
  border-radius: 1.15rem;
  background:
    linear-gradient(135deg, rgba(var(--primary-color-rgb), 0.16), transparent 55%),
    rgba(var(--accent-color-rgb), 0.08);
}

.apercu__photo {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 4.5rem;
  height: 4.5rem;
  overflow: hidden;
  border: 2px solid var(--primary-color);
  border-radius: 0.9rem;
  color: var(--bg-color);
  background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
  font-family: var(--font-display);
  font-size: 1.6rem;
  font-weight: 900;
}

.apercu__photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.apercu__eyebrow {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--accent-color);
}

.apercu__pseudo {
  margin-top: 0.15rem;
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-weight: 900;
  overflow-wrap: anywhere;
  color: var(--text-color);
}

.apercu__nom {
  margin-top: 0.15rem;
  font-size: 0.85rem;
  color: var(--muted-color);
  overflow-wrap: anywhere;
}

.apercu__ligne {
  margin-top: 0.35rem;
  font-size: 0.78rem;
  color: var(--muted-color);
  overflow-wrap: anywhere;
}

.apercu__bio {
  margin-top: 0.4rem;
  font-size: 0.78rem;
  color: var(--muted-color);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (min-width: 640px) {
  .carte-form__photo {
    flex-direction: row;
    align-items: flex-start;
  }

  .carte-form__grille {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .champ--large {
    grid-column: span 2;
  }

  .apercu {
    flex-direction: row;
    align-items: center;
    gap: 1rem;
  }
}

@media (min-width: 1024px) {
  .carte-form__grille {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .champ--large {
    grid-column: span 1;
  }
}
</style>
