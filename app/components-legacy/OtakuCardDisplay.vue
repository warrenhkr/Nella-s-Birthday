<script setup lang="ts">
import { polesToText } from '#shared/poles'

// ============================================================
// OtakuCardDisplay — la vraie carte de membre du Club Otaku ENEAM.
//
// Montre l'identité validée : photo/avatar, pseudo otaku, nom complet,
// pôle, numéro de membre, année, niveau et univers otaku (animes, mangas,
// jeu favori, bio).
//
// Deux actions concrètes, sans aucune dépendance supplémentaire :
//   * « Télécharger » exporte la carte en SVG autonome (fichier image
//     ouvrable partout, photo embarquée en data-URL quand le navigateur
//     l'autorise) ;
//   * « Partager » utilise le partage natif du téléphone (navigator.share)
//     et retombe sur la copie du lien dans le presse-papiers.
//
// Toutes les couleurs de l'export sont LUES dans les variables CSS du thème
// courant : aucune couleur codée en dur, le fichier téléchargé respecte donc
// le style actif (persona rouge/noir, cyberpunk, clair ou sombre).
// ============================================================

type CardMember = {
  nom?: string | null
  prenom?: string | null
  pseudo?: string | null
  pole?: string | null
  /** Multi-pôles : union « poles + pole » fournie par l'API. */
  poles?: string[] | null
  level?: string | null
  avatar?: string | null
  situation?: 'STUDENT_BENIN' | 'STUDENT_ABROAD' | 'PROFESSIONAL' | null
  pays?: string | null
  profession?: string | null
  universite?: string | null
  filiere?: string | null
}

type OtakuCard = {
  id?: string | null
  displayName: string
  imageUrl: string | null
  favoriteAnime: string | null
  favoriteManga: string | null
  favoriteAnimes: string[]
  favoriteMangas: string[]
  favoriteGame: string | null
  bio: string | null
  status?: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt?: string | null
}

const props = withDefaults(defineProps<{
  card: OtakuCard
  member?: CardMember | null
}>(), {
  member: null
})

const { success, alert } = useGameToast()

const animes = computed(() => props.card.favoriteAnimes?.length
  ? props.card.favoriteAnimes
  : props.card.favoriteAnime ? [props.card.favoriteAnime] : [])

const mangas = computed(() => props.card.favoriteMangas?.length
  ? props.card.favoriteMangas
  : props.card.favoriteManga ? [props.card.favoriteManga] : [])

const pseudo = computed(() => (props.member?.pseudo || props.card.displayName || '').trim())

const nomComplet = computed(() => {
  const morceaux = [props.member?.prenom, props.member?.nom]
    .map(morceau => (morceau || '').trim())
    .filter(Boolean)
  return morceaux.length ? morceaux.join(' ') : pseudo.value
})

const pole = computed(() => polesToText(props.member, 'Culture'))
const niveau = computed(() => (props.member?.level || 'Crew').trim())
const avatar = computed(() => props.card.imageUrl || props.member?.avatar || null)
const situationDetail = computed(() => {
  if (props.member?.situation === 'PROFESSIONAL') return props.member.profession ? `Profession · ${props.member.profession}` : ''
  if (props.member?.situation === 'STUDENT_ABROAD') {
    const details = [props.member.pays, props.member.universite, props.member.filiere].filter(Boolean)
    return details.length ? `Étudiant·e à l’étranger · ${details.join(' · ')}` : ''
  }
  const details = [props.member?.universite, props.member?.filiere].filter(Boolean)
  return details.length ? `Étudiant·e au Bénin · ${details.join(' · ')}` : ''
})
const initiale = computed(() => (pseudo.value.charAt(0) || '?').toUpperCase())

const annee = computed(() => {
  const date = props.card.createdAt ? new Date(props.card.createdAt) : new Date()
  return Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear()
})

// Numéro de membre : dérivé de l'identifiant réel de la carte (stable,
// non modifiable, sans donnée sensible) + l'année de validation.
const numeroMembre = computed(() => {
  const suffixe = (props.card.id || '').replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase()
  return suffixe ? `${annee.value}-${suffixe}` : String(annee.value)
})

const statutLabel = computed(() => {
  if (props.card.status === 'APPROVED') return 'Membre validée'
  if (props.card.status === 'REJECTED') return 'À corriger'
  return 'En validation'
})

const jeuxFavoris = computed(() => (props.card.favoriteGame || '').trim())

const carteOuverte = ref(false)
const telechargement = ref(false)
const partageEnCours = ref(false)

// ---------- Utilitaires d'export ----------

function valeurCss(nom: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(nom).trim()
}

function couleur(valeur: string) {
  // Repli neutre : aucune couleur de thème n'est codée en dur ici.
  return valeur || 'transparent'
}

function echapper(texte: string) {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function photoEnDataUrl(): Promise<string | null> {
  const source = avatar.value
  if (!source || typeof fetch === 'undefined') return null

  try {
    const reponse = await fetch(source, { mode: 'cors' })
    if (!reponse.ok) return null
    const blob = await reponse.blob()
    return await new Promise<string>((resolve, reject) => {
      const lecteur = new FileReader()
      lecteur.onload = () => resolve(String(lecteur.result || ''))
      lecteur.onerror = () => reject(new Error('lecture impossible'))
      lecteur.readAsDataURL(blob)
    })
  } catch {
    // Photo distante non exploitable (CORS, réseau) : la carte partira avec
    // l'initiale, ce qui reste parfaitement lisible.
    return null
  }
}

type Palette = {
  primaire: string
  accent: string
  fond: string
  panneau: string
  texte: string
  muet: string
  bordure: string
}

function palette(): Palette {
  return {
    primaire: valeurCss('--primary-color'),
    accent: valeurCss('--accent-color'),
    fond: valeurCss('--bg-color'),
    panneau: valeurCss('--bg-color-soft') || valeurCss('--panel-color-solid'),
    texte: valeurCss('--text-color'),
    muet: valeurCss('--muted-color'),
    bordure: valeurCss('--border-color')
  }
}

function couperTexte(texte: string, limite: number): string[] {
  const mots = texte.trim().split(/\s+/).filter(Boolean)
  const lignes: string[] = []
  let ligne = ''

  for (const mot of mots) {
    const tentative = ligne ? `${ligne} ${mot}` : mot
    if (tentative.length > limite && ligne) {
      lignes.push(ligne)
      ligne = mot
    } else {
      ligne = tentative
    }
  }

  if (ligne) lignes.push(ligne)
  return lignes
}

async function construireSvg(): Promise<string> {
  const teintes = palette()
  const photo = await photoEnDataUrl()
  const portrait = photo
    ? `<image x="88" y="132" width="230" height="230" preserveAspectRatio="xMidYMid slice" clip-path="url(#portrait)" href="${photo}" xlink:href="${photo}"/>`
    : `<text x="203" y="285" font-family="sans-serif" font-size="108" font-weight="900" text-anchor="middle" fill="${couleur(teintes.fond)}">${echapper(initiale.value)}</text>`

  const sections = [
    { label: 'SITUATION', value: situationDetail.value },
    { label: 'PÔLES', value: pole.value },
    { label: 'N° MEMBRE · ANNÉE · NIVEAU', value: `${numeroMembre.value} · ${annee.value} · ${niveau.value}` },
    { label: 'ANIMÉS FAVORIS', value: animes.value.join(' · ') },
    { label: 'MANGAS FAVORIS', value: mangas.value.join(' · ') },
    { label: 'JEU FAVORI', value: jeuxFavoris.value },
    { label: 'À PROPOS', value: (props.card.bio || '').trim() }
  ].filter(section => section.value)

  let y = 435
  const details = sections.map((section) => {
    const lignes = couperTexte(section.value, 68)
    const debut = y
    const contenu = lignes.map((ligne, index) => {
      const texte = `<text x="390" y="${y + 61 + index * 31}" font-family="sans-serif" font-size="25" fill="${couleur(teintes.texte)}">${echapper(ligne)}</text>`
      return texte
    }).join('\n')
    y += 42 + Math.max(1, lignes.length) * 31
    return `<text x="90" y="${debut + 27}" font-family="monospace" font-size="15" font-weight="700" letter-spacing="2" fill="${couleur(teintes.accent)}">${echapper(section.label)}</text>${contenu}`
  }).join('\n')
  const hauteur = Math.max(710, y + 64)

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1400" height="${hauteur}" viewBox="0 0 1400 ${hauteur}" role="img" aria-label="Carte Otaku de ${echapper(pseudo.value)}">
  <defs>
    <linearGradient id="fond" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${couleur(teintes.panneau)}"/>
      <stop offset="0.55" stop-color="${couleur(teintes.fond)}"/>
      <stop offset="1" stop-color="${couleur(teintes.panneau)}"/>
    </linearGradient>
    <linearGradient id="bande" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${couleur(teintes.primaire)}"/>
      <stop offset="1" stop-color="${couleur(teintes.accent)}"/>
    </linearGradient>
    <radialGradient id="lueur" cx="0.85" cy="0.1" r="0.8">
      <stop offset="0" stop-color="${couleur(teintes.primaire)}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="${couleur(teintes.primaire)}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="portrait"><circle cx="203" cy="247" r="115"/></clipPath>
  </defs>

  <rect width="1400" height="${hauteur}" rx="42" fill="url(#fond)"/>
  <rect width="1400" height="${hauteur}" rx="42" fill="url(#lueur)"/>
  <rect x="18" y="18" width="1364" height="${hauteur - 36}" rx="30" fill="none" stroke="${couleur(teintes.bordure)}"/>
  <rect x="0" y="0" width="1400" height="16" rx="8" fill="url(#bande)"/>

  <text x="88" y="85" font-family="monospace" font-size="22" letter-spacing="7" fill="${couleur(teintes.muet)}">CLUB OTAKU · ENEAM</text>
  <text x="1312" y="85" font-family="monospace" font-size="18" letter-spacing="3" text-anchor="end" fill="${couleur(teintes.accent)}">${echapper(statutLabel.value.toUpperCase())}</text>

  <circle cx="203" cy="247" r="120" fill="url(#bande)"/>
  <circle cx="203" cy="247" r="120" fill="none" stroke="${couleur(teintes.primaire)}" stroke-width="4"/>
  ${portrait}

  <text x="390" y="190" font-family="monospace" font-size="20" letter-spacing="8" fill="${couleur(teintes.accent)}">CARTE OTAKU</text>
  <text x="390" y="270" font-family="sans-serif" font-size="62" font-weight="900" fill="${couleur(teintes.texte)}">${echapper(pseudo.value || 'Membre otaku')}</text>
  <text x="390" y="320" font-family="sans-serif" font-size="30" fill="${couleur(teintes.muet)}">${echapper(nomComplet.value)}</text>

  <line x1="88" y1="395" x2="1312" y2="395" stroke="${couleur(teintes.bordure)}"/>
  ${details}
</svg>`
}

async function telechargerLaCarte(format: 'png' | 'jpg') {
  telechargement.value = true
  try {
    const svg = await construireSvg()
    const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
    const image = new Image()
    image.src = svgUrl
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Impossible de préparer la carte'))
    })

    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth * 2
    canvas.height = image.naturalHeight * 2
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas indisponible')
    if (format === 'jpg') {
      context.fillStyle = palette().fond || '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    context.scale(2, 2)
    context.drawImage(image, 0, 0)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        value => value ? resolve(value) : reject(new Error('Export image impossible')),
        format === 'jpg' ? 'image/jpeg' : 'image/png',
        0.95
      )
    })
    URL.revokeObjectURL(svgUrl)
    const url = URL.createObjectURL(blob)
    const lien = document.createElement('a')
    lien.href = url
    lien.download = `carte-otaku-${(pseudo.value || 'membre').toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.${format}`
    document.body.appendChild(lien)
    lien.click()
    lien.remove()
    URL.revokeObjectURL(url)
    success(`Carte Otaku téléchargée en ${format.toUpperCase()}.`)
  } catch {
    alert('Impossible de télécharger la carte pour le moment.')
  } finally {
    telechargement.value = false
  }
}

async function partagerLaCarte() {
  partageEnCours.value = true
  const titre = 'Ma carte Otaku'
  const texte = `${pseudo.value} · ${pole.value} · Club Otaku ENEAM`
  const lien = typeof window === 'undefined' ? '' : window.location.href

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ title: titre, text: texte, url: lien })
      return
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(`${texte} — ${lien}`)
      success('Lien de ta carte copié.')
      return
    }

    alert('Le partage n’est pas disponible sur cet appareil.')
  } catch (erreur: unknown) {
    // L'annulation volontaire du menu de partage n'est pas une erreur.
    if ((erreur as { name?: string })?.name === 'AbortError') return
    alert('Impossible de partager ta carte pour le moment.')
  } finally {
    partageEnCours.value = false
  }
}

function ouvrirCarte() {
  carteOuverte.value = true
}

function gererClavierCarte(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  ouvrirCarte()
}
</script>

<template>
  <div class="otaku-card-shell">
    <article
      class="otaku-card"
      role="button"
      tabindex="0"
      aria-haspopup="dialog"
      :aria-label="`Carte Otaku de ${pseudo}`"
      @click="ouvrirCarte"
      @keydown="gererClavierCarte"
    >
      <span
        class="otaku-card__grid"
        aria-hidden="true"
      />
      <span
        class="otaku-card__glow"
        aria-hidden="true"
      />
      <span
        class="otaku-card__sheen"
        aria-hidden="true"
      />

      <header class="otaku-card__top">
        <span class="otaku-card__brand">
          <span class="otaku-card__brand-mark">OE</span>
          <span class="otaku-card__brand-text">
            <strong>Club Otaku</strong>
            <em>ENEAM</em>
          </span>
        </span>
        <span class="otaku-card__status">{{ statutLabel }}</span>
      </header>

      <div class="otaku-card__main">
        <div class="otaku-card__portrait">
          <img
            v-if="avatar"
            :src="avatar"
            :alt="`Photo de ${pseudo}`"
            loading="lazy"
          >
          <span v-else>{{ initiale }}</span>
        </div>
        <div class="otaku-card__identity">
          <p class="otaku-card__eyebrow">
            Carte Otaku
          </p>
          <h2 class="otaku-card__pseudo">
            {{ pseudo }}
          </h2>
          <p class="otaku-card__nom">
            {{ nomComplet }}
          </p>
          <p
            v-if="situationDetail"
            class="otaku-card__bio"
          >
            {{ situationDetail }}
          </p>
          <p
            v-if="card.bio"
            class="otaku-card__bio"
          >
            {{ card.bio }}
          </p>
        </div>
      </div>

      <dl class="otaku-card__meta">
        <div class="otaku-card__meta-item">
          <dt>
            <UIcon
              name="i-lucide-users"
              aria-hidden="true"
            />
            Pôles
          </dt>
          <dd>{{ pole }}</dd>
        </div>
        <div class="otaku-card__meta-item">
          <dt>
            <UIcon
              name="i-lucide-hash"
              aria-hidden="true"
            />
            N° membre
          </dt>
          <dd>{{ numeroMembre }}</dd>
        </div>
        <div class="otaku-card__meta-item">
          <dt>
            <UIcon
              name="i-lucide-calendar-days"
              aria-hidden="true"
            />
            Année
          </dt>
          <dd>{{ annee }}</dd>
        </div>
        <div class="otaku-card__meta-item">
          <dt>
            <UIcon
              name="i-lucide-shield-check"
              aria-hidden="true"
            />
            Niveau
          </dt>
          <dd>{{ niveau }}</dd>
        </div>
      </dl>

      <footer class="otaku-card__foot">
        <ul
          v-if="animes.length || mangas.length || jeuxFavoris"
          class="otaku-card__tags"
        >
          <li
            v-for="anime in animes"
            :key="`anime-${anime}`"
            class="otaku-card__tag"
          >
            <UIcon
              name="i-lucide-tv"
              aria-hidden="true"
            />
            {{ anime }}
          </li>
          <li
            v-for="manga in mangas"
            :key="`manga-${manga}`"
            class="otaku-card__tag"
          >
            <UIcon
              name="i-lucide-book-open"
              aria-hidden="true"
            />
            {{ manga }}
          </li>
          <li
            v-if="jeuxFavoris"
            class="otaku-card__tag"
          >
            <UIcon
              name="i-lucide-gamepad-2"
              aria-hidden="true"
            />
            {{ jeuxFavoris }}
          </li>
        </ul>
        <p
          v-else
          class="otaku-card__vide"
        >
          Ajoute tes animes et mangas favoris pour compléter ta carte.
        </p>
        <p class="otaku-card__signature">
          <UIcon
            name="i-lucide-sparkles"
            aria-hidden="true"
          />
          Otaku Network · identité validée
        </p>
      </footer>
    </article>
  </div>

  <UModal
    v-model:open="carteOuverte"
    :title="`Carte Otaku · ${pseudo}`"
    :ui="{ content: 'otaku-card-modal max-w-5xl' }"
  >
    <template #body>
      <div class="otaku-card-detail">
        <article class="otaku-card otaku-card--expanded">
          <span
            class="otaku-card__grid"
            aria-hidden="true"
          />
          <span
            class="otaku-card__glow"
            aria-hidden="true"
          />
          <header class="otaku-card__top">
            <span class="otaku-card__brand">
              <span class="otaku-card__brand-mark">OE</span>
              <span class="otaku-card__brand-text">
                <strong>Club Otaku</strong>
                <em>ENEAM</em>
              </span>
            </span>
            <span class="otaku-card__status">{{ statutLabel }}</span>
          </header>

          <div class="otaku-card__main">
            <div class="otaku-card__portrait otaku-card__portrait--expanded">
              <img
                v-if="avatar"
                :src="avatar"
                :alt="`Photo de ${pseudo}`"
              >
              <span v-else>{{ initiale }}</span>
            </div>
            <div class="otaku-card__identity">
              <p class="otaku-card__eyebrow">
                Carte Otaku
              </p>
              <h2 class="otaku-card__pseudo">
                {{ pseudo }}
              </h2>
              <p class="otaku-card__nom">
                {{ nomComplet }}
              </p>
              <p
                v-if="situationDetail"
                class="otaku-card__bio"
              >
                {{ situationDetail }}
              </p>
              <p
                v-if="card.bio"
                class="otaku-card__bio otaku-card__bio--expanded"
              >
                {{ card.bio }}
              </p>
            </div>
          </div>

          <dl class="otaku-card__meta">
            <div class="otaku-card__meta-item">
              <dt>Pôles</dt>
              <dd>{{ pole }}</dd>
            </div>
            <div class="otaku-card__meta-item">
              <dt>N° membre</dt>
              <dd>{{ numeroMembre }}</dd>
            </div>
            <div class="otaku-card__meta-item">
              <dt>Année</dt>
              <dd>{{ annee }}</dd>
            </div>
            <div class="otaku-card__meta-item">
              <dt>Niveau</dt>
              <dd>{{ niveau }}</dd>
            </div>
          </dl>

          <div class="otaku-card-detail__favorites">
            <section
              v-if="animes.length"
              class="otaku-card-detail__section"
            >
              <h3>Animes favoris</h3>
              <ul>
                <li
                  v-for="anime in animes"
                  :key="anime"
                >
                  {{ anime }}
                </li>
              </ul>
            </section>
            <section
              v-if="mangas.length"
              class="otaku-card-detail__section"
            >
              <h3>Mangas favoris</h3>
              <ul>
                <li
                  v-for="manga in mangas"
                  :key="manga"
                >
                  {{ manga }}
                </li>
              </ul>
            </section>
            <section
              v-if="jeuxFavoris"
              class="otaku-card-detail__section"
            >
              <h3>Jeu favori</h3>
              <p>{{ jeuxFavoris }}</p>
            </section>
            <p
              v-if="!animes.length && !mangas.length && !jeuxFavoris"
              class="otaku-card__vide"
            >
              Aucun favori renseigné.
            </p>
          </div>
        </article>

        <div
          class="otaku-card-actions"
          aria-label="Actions sur la carte"
        >
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-image"
            aria-label="Télécharger en PNG"
            title="Télécharger en PNG"
            :loading="telechargement"
            :disabled="telechargement"
            @click="telechargerLaCarte('png')"
          />
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-file-image"
            aria-label="Télécharger en JPG"
            title="Télécharger en JPG"
            :loading="telechargement"
            :disabled="telechargement"
            @click="telechargerLaCarte('jpg')"
          />
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-share-2"
            aria-label="Partager la carte"
            title="Partager la carte"
            :loading="partageEnCours"
            @click="partagerLaCarte"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.otaku-card-shell {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

.otaku-card {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  min-width: 0;
  padding: clamp(1.1rem, 4vw, 1.75rem);
  border: 1px solid rgba(var(--primary-color-rgb), 0.35);
  border-radius: 1.35rem;
  color: var(--text-color);
  background:
    linear-gradient(135deg, rgba(var(--primary-color-rgb), 0.2), transparent 46%),
    linear-gradient(315deg, rgba(var(--accent-color-rgb), 0.18), transparent 54%),
    var(--bg-color-soft);
  box-shadow: 0 24px 60px -34px rgba(var(--primary-color-rgb), 0.9);
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.otaku-card[role='button']:hover {
  transform: translateY(-3px);
  border-color: rgba(var(--accent-color-rgb), 0.68);
  box-shadow: 0 28px 64px -32px rgba(var(--primary-color-rgb), 1);
}

.otaku-card[role='button']:focus-visible {
  outline: 3px solid var(--accent-color);
  outline-offset: 4px;
}

.otaku-card--expanded {
  cursor: default;
}

.otaku-card--expanded:hover {
  transform: none;
}

.otaku-card__grid,
.otaku-card__glow,
.otaku-card__sheen {
  position: absolute;
  z-index: -1;
  pointer-events: none;
}

.otaku-card__grid {
  inset: 0;
  opacity: 0.55;
  background-image:
    linear-gradient(rgba(var(--primary-color-rgb), 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(var(--primary-color-rgb), 0.07) 1px, transparent 1px);
  background-size: 28px 28px;
  -webkit-mask-image: radial-gradient(circle at 18% 0%, black, transparent 74%);
  mask-image: radial-gradient(circle at 18% 0%, black, transparent 74%);
}

.otaku-card__glow {
  top: -6rem;
  right: -4rem;
  width: 15rem;
  height: 15rem;
  border-radius: 50%;
  background: rgba(var(--accent-color-rgb), 0.2);
  filter: blur(38px);
}

.otaku-card__sheen {
  inset: 0;
  background: linear-gradient(115deg, transparent 38%, rgba(var(--primary-color-rgb), 0.14) 50%, transparent 62%);
}

.otaku-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-width: 0;
  padding-bottom: 0.9rem;
  border-bottom: 1px solid var(--border-color);
}

.otaku-card__brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
}

.otaku-card__brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 2.15rem;
  height: 2.15rem;
  border-radius: 0.7rem;
  color: var(--bg-color);
  background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
  font-family: var(--font-display);
  font-size: 0.85rem;
  font-weight: 900;
}

.otaku-card__brand-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.05;
}

.otaku-card__brand-text strong {
  font-family: var(--font-display);
  font-size: 0.85rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  color: var(--text-color);
}

.otaku-card__brand-text em {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  font-style: normal;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: var(--muted-color);
}

.otaku-card__status {
  flex: 0 0 auto;
  padding: 0.32rem 0.6rem;
  border: 1px solid rgba(var(--accent-color-rgb), 0.5);
  border-radius: 999px;
  color: var(--accent-color);
  font-family: var(--font-mono);
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.otaku-card__main {
  display: flex;
  align-items: center;
  gap: 1.1rem;
  min-width: 0;
  margin-top: 1.15rem;
}

.otaku-card__portrait {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 6rem;
  height: 6rem;
  overflow: hidden;
  border: 2px solid var(--primary-color);
  border-radius: 1.15rem;
  color: var(--bg-color);
  background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
  font-family: var(--font-display);
  font-size: 2.1rem;
  font-weight: 900;
  box-shadow: 0 14px 30px -18px rgba(var(--primary-color-rgb), 1);
}

.otaku-card__portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.otaku-card__identity {
  min-width: 0;
}

.otaku-card__eyebrow {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--accent-color);
}

.otaku-card__pseudo {
  margin-top: 0.25rem;
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 6vw, 2.1rem);
  font-weight: 900;
  line-height: 1.05;
  overflow-wrap: anywhere;
  color: var(--text-color);
}

.otaku-card__nom {
  margin-top: 0.25rem;
  font-size: 0.9rem;
  color: var(--muted-color);
  overflow-wrap: anywhere;
}

.otaku-card__bio {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--muted-color);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.otaku-card__bio--expanded {
  display: block;
  overflow: visible;
}

.otaku-card__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem 1rem;
  margin-top: 1.15rem;
  padding-top: 1rem;
  border-top: 1px dashed var(--border-color);
}

.otaku-card__meta-item {
  min-width: 0;
}

.otaku-card__meta-item dt {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted-color);
}

.otaku-card__meta-item dt :deep(svg) {
  width: 0.85rem;
  height: 0.85rem;
}

.otaku-card__meta-item dd {
  margin: 0.2rem 0 0;
  font-size: 0.95rem;
  font-weight: 700;
  overflow-wrap: anywhere;
  color: var(--text-color);
}

.otaku-card__foot {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  margin-top: 1.15rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.otaku-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  min-width: 0;
}

.otaku-card__tag {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  max-width: 100%;
  padding: 0.3rem 0.55rem;
  border: 1px solid rgba(var(--primary-color-rgb), 0.28);
  border-radius: 999px;
  background: rgba(var(--primary-color-rgb), 0.1);
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.otaku-card__tag :deep(svg) {
  width: 0.8rem;
  height: 0.8rem;
  color: var(--accent-color);
}

.otaku-card__vide {
  font-size: 0.78rem;
  color: var(--muted-color);
}

.otaku-card__signature {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted-color);
}

.otaku-card__signature :deep(svg) {
  width: 0.85rem;
  height: 0.85rem;
  color: var(--accent-color);
}

.otaku-card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  padding-top: 0.75rem;
}

.otaku-card-actions :deep(button) {
  width: 2.85rem;
  height: 2.85rem;
  justify-content: center;
}

.otaku-card-modal {
  width: min(96vw, 68rem);
  max-height: 94dvh;
  overflow: auto;
}

.otaku-card-detail {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  min-width: 0;
}

.otaku-card-detail__favorites {
  display: grid;
  gap: 0.85rem;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.otaku-card-detail__section {
  min-width: 0;
  padding: 0.85rem;
  border: 1px solid var(--border-color);
  border-radius: 0.65rem;
  background: rgba(var(--primary-color-rgb), 0.045);
}

.otaku-card-detail__section h3 {
  margin-bottom: 0.45rem;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent-color);
}

.otaku-card-detail__section ul {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.otaku-card-detail__section li,
.otaku-card-detail__section p {
  overflow-wrap: anywhere;
  color: var(--text-color);
  font-size: 0.86rem;
}

.otaku-card-detail__section li {
  padding: 0.25rem 0.5rem;
  border-radius: 0.4rem;
  background: rgba(var(--accent-color-rgb), 0.1);
}

@media (max-width: 420px) {
  .otaku-card__main {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.85rem;
  }

  .otaku-card__portrait {
    width: 4.75rem;
    height: 4.75rem;
    font-size: 1.7rem;
  }

  .otaku-card--expanded .otaku-card__main {
    flex-direction: row;
    align-items: center;
  }

  .otaku-card--expanded .otaku-card__portrait {
    width: 4rem;
    height: 4rem;
    font-size: 1.45rem;
  }
}
</style>
