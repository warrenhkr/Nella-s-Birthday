<script setup lang="ts">
const config = useRuntimeConfig()
const { playSfx } = useSoundManager()

const defaultHomeData = {
  heroStats: [
    { label: 'Membres actifs', value: '0' },
    { label: 'Événements', value: '0' },
    { label: 'Tournois', value: '0' },
    { label: 'Cartes Otaku', value: '0' }
  ],
  poles: [
    { name: 'Anime', icon: 'i-lucide-film', description: 'Séries, recommandations, clubs de visionnage et moments de partage.' },
    { name: 'Manga', icon: 'i-lucide-book-open', description: 'Sorties, critiques, découvertes et atlas de lecture.' },
    { name: 'Gaming', icon: 'i-lucide-gamepad-2', description: 'Tournois, rencontres, sessions de jeu et compétitions campus.' },
    { name: 'Danse', icon: 'i-lucide-music-4', description: 'Chorégraphies, performances, crew et animations culturelles.' },
    { name: 'K-Drama', icon: 'i-lucide-clapperboard', description: 'Buzz, drama du moment et recommandations de la communauté.' },
    { name: 'Culture', icon: 'i-lucide-sparkles', description: 'Cosplay, tendances, fandom et activités de sensibilisation.' }
  ],
  activityHighlights: [
    { name: 'Tournois', detail: 'Compétitions campus', icon: 'i-lucide-swords', tone: 'primary' },
    { name: 'Ateliers', detail: 'Création & culture pop', icon: 'i-lucide-users-round', tone: 'accent' },
    { name: 'Watch party', detail: 'Sessions anime', icon: 'i-lucide-monitor-play', tone: 'neutral' }
  ],
  shopHighlights: []
}

type ShopProduct = {
  id: string
  title: string
  price: number
  tag: string
  category: string
  imageUrl: string | null
  whatsappNumber: string | null
}

type HomeResponse = {
  data: typeof defaultHomeData
}

const { data: homeResponse, pending: homePending, error: homeError, refresh: refreshHome } = await useFetch<HomeResponse>('/api/home')
const homeData = computed(() => homeResponse.value?.data ?? defaultHomeData)

const heroStats = computed(() => homeData.value.heroStats)
const poles = computed(() => homeData.value.poles)
const shopHighlights = computed(() => homeData.value.shopHighlights as ShopProduct[])

function getStatDisplay(value: string) {
  const match = value.trim().match(/^([\d.]+)(.*)$/)
  const numericValue = Number(match?.[1] ?? 0)
  const suffix = match?.[2] ?? ''
  const decimalPart = match?.[1]?.split('.')[1]

  return {
    value: Number.isFinite(numericValue) ? numericValue : 0,
    decimals: decimalPart?.length ?? 0,
    suffix
  }
}

async function retryHome() {
  await refreshHome()
}

function orderViaWhatsapp(product: ShopProduct) {
  const number = String(product.whatsappNumber || config.public.whatsappNumber || '').replace(/\D/g, '')
  const message = `Bonjour, je souhaite commander : ${product.title} (${product.price.toLocaleString()} FCFA).`
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank', 'noopener')
  playSfx('click')
}

// Effet cinématique sur le titre hero : découpe lettre par lettre + montée
// en cascade au montage. Nettoyage complet à la destruction du composant.
const heroTitle = ref<HTMLElement | null>(null)
const { play: playTitleSplit, cleanup: cleanupTitleSplit } = useSplitTitle(heroTitle, {
  types: 'words',
  stagger: 0.018,
  duration: 0.6
})

onMounted(() => {
  window.setTimeout(() => playTitleSplit(), 120)
})

onUnmounted(() => {
  cleanupTitleSplit()
})
</script>

<template>
  <div class="landing-page min-h-screen">
    <section class="relative mx-auto max-w-7xl overflow-hidden px-4 pb-20 pt-16 lg:px-8 lg:pb-28 lg:pt-24">
      <div class="mx-auto max-w-4xl text-center">
        <div>
          <div class="hero-signal mx-auto mb-6">
            <span class="hero-signal__dot"></span>
            <span>SITE OFFICIEL // CLUB OTAKU ENEAM</span>
            <span class="hero-signal__status">LIVE</span>
          </div>
          <p class="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-accent-otaku">
            Le club Otaku de l'ENEAM
          </p>
          <h1 ref="heroTitle" class="font-display text-5xl font-black leading-[0.98] tracking-tight md:text-7xl" style="color: var(--text-color);">
            Vis, partage et crée ta passion otaku.
          </h1>
          <p class="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted md:text-xl">
            Rejoins les activités du Club Otaku ENEAM : anime, manga, gaming, K-drama, danse et culture pop, dans une communauté qui se retrouve pour vivre ses passions ensemble.
          </p>

          <div class="mt-9 flex flex-wrap justify-center gap-4">
            <UButton class="whitespace-nowrap" size="lg" color="primary" icon="i-lucide-users-round" label="Rejoindre le Club Otaku" to="https://chat.whatsapp.com/D9kL9wopG5d3NEiyKtGeBw" target="_blank" />
            <UButton class="hero-events-button whitespace-nowrap" size="lg" color="primary" variant="outline" icon="i-lucide-calendar-days" label="Découvrir nos activités" to="/evenements" />
          </div>

          <div v-if="homePending" class="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <USkeleton v-for="index in 4" :key="index" class="h-24" />
          </div>

          <div v-else-if="homeError" class="mt-10 surface-solid p-4 text-sm text-muted">
            <p>Les données en direct sont momentanément indisponibles.</p>
            <UButton class="mt-3" color="primary" variant="soft" label="Réessayer" @click="retryHome" />
          </div>

          <div v-else class="mt-14 grid grid-cols-2 gap-4 text-left sm:grid-cols-4">
            <div v-for="stat in heroStats" :key="stat.label" class="stat-tile surface-solid">
              <div class="text-2xl font-black" style="color: var(--text-color);">
                <CountUp v-bind="getStatDisplay(stat.value)" />
              </div>
              <div class="mt-1 text-xs uppercase tracking-[0.2em] text-muted">{{ stat.label }}</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <ScrollReveal tag="section" class="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <div class="mb-8 flex items-end justify-between">
        <div>
          <p class="text-xs uppercase tracking-[0.28em] text-accent-otaku">Pôles</p>
          <h2 class="mt-2 font-display text-3xl font-black" style="color: var(--text-color);">Le club en mouvement</h2>
        </div>
        <UButton color="neutral" variant="ghost" label="Explorer tout" to="/communaute" />
      </div>

      <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <UCard v-for="pole in poles" :key="pole.name" class="rounded-xl border border-default bg-white/5 shadow-none backdrop-blur-md">
          <div class="pole-icon mb-5">
            <UIcon :name="pole.icon" class="h-5 w-5" />
          </div>
          <h3 class="text-xl font-semibold" style="color: var(--text-color);">{{ pole.name }}</h3>
          <p class="mt-3 text-sm leading-6 text-muted">{{ pole.description }}</p>
        </UCard>
      </div>
    </ScrollReveal>

    <ScrollReveal tag="section" class="mx-auto max-w-7xl px-4 pb-8 lg:px-8" :delay="0.04">
      <div class="gaming-mode-grid">
        <div class="gaming-mode-grid__intro">
          <p class="text-xs uppercase tracking-[0.28em] text-accent-otaku">Activités du club</p>
          <h2 class="mt-2 font-display text-2xl font-black" style="color: var(--text-color);">Une place pour chaque passion.</h2>
          <p class="mt-3 max-w-md text-sm leading-6 text-muted">Découvre les activités qui font vivre le club, du partage autour des anime aux tournois gaming.</p>
        </div>
        <NuxtLink v-for="activity in homeData.activityHighlights" :key="activity.name" to="/evenements" class="gaming-mode-card" :class="`gaming-mode-card--${activity.tone}`">
          <div class="gaming-mode-card__icon"><UIcon :name="activity.icon" class="h-5 w-5" /></div>
          <div>
            <div class="text-base font-bold" style="color: var(--text-color);">{{ activity.name }}</div>
            <div class="mt-1 text-xs text-muted">{{ activity.detail }}</div>
          </div>
          <UIcon name="i-lucide-arrow-up-right" class="gaming-mode-card__arrow h-4 w-4" />
        </NuxtLink>
      </div>
    </ScrollReveal>

    <ScrollReveal tag="section" class="mx-auto max-w-7xl px-4 py-8 lg:px-8" :delay="0.12">
      <div class="mb-8 flex items-end justify-between gap-4">
        <div>
          <p class="text-xs uppercase tracking-[0.28em] text-accent-otaku">Boutique</p>
          <h2 class="mt-2 font-display text-3xl font-black" style="color: var(--text-color);">Produits du club</h2>
        </div>
        <UButton color="primary" label="Voir la boutique" to="/boutique" />
      </div>

      <div v-if="shopHighlights.length === 0" class="product-empty-state surface-solid text-center">
        <p class="text-sm text-muted">Les produits du club seront bientôt disponibles.</p>
        <UButton class="mt-4" color="primary" variant="soft" label="Accéder à la boutique" to="/boutique" />
      </div>

      <div v-else class="grid gap-5 md:grid-cols-3">
        <UCard v-for="product in shopHighlights" :key="product.id" class="rounded-xl border border-default bg-white/5 shadow-none backdrop-blur-md">
          <div
            class="shop-preview-image"
            :style="product.imageUrl ? { backgroundImage: `url(${product.imageUrl})` } : undefined"
          ></div>
          <span class="shop-preview-tag">{{ product.tag }}</span>
          <h3 class="mt-4 text-lg font-semibold" style="color: var(--text-color);">{{ product.title }}</h3>
          <div class="mt-2 text-xs uppercase tracking-[0.2em] text-muted">{{ product.category }}</div>
          <div class="mt-4 flex items-center justify-between gap-3">
            <span class="text-xl font-black text-accent-otaku">{{ product.price.toLocaleString() }} FCFA</span>
            <UButton color="primary" variant="soft" icon="i-simple-icons-whatsapp" label="Commander" @click="orderViaWhatsapp(product)" />
          </div>
        </UCard>
      </div>
    </ScrollReveal>

  </div>
</template>

<style scoped>
.landing-page {
  overflow-wrap: normal;
  word-break: normal;
  hyphens: none;
}

.stat-tile {
  border-radius: 1rem;
  padding: 1rem;
}

.hero-signal {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.45rem 0.65rem;
  color: var(--muted-color);
  background: rgba(var(--accent-color-rgb), 0.06);
  border: 1px solid rgba(var(--accent-color-rgb), 0.22);
  border-radius: 999px;
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  flex-wrap: wrap;
  justify-content: center;
}

.hero-signal__dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: var(--accent-color);
  box-shadow: 0 0 12px var(--accent-color);
}

.hero-signal__status { color: var(--accent-color); }

.hero-events-button {
  color: var(--text-color) !important;
  border-color: var(--primary-color) !important;
  background: var(--bg-color-soft) !important;
}

.hero-events-button:hover {
  color: var(--primary-color) !important;
  background: rgba(var(--primary-color-rgb), 0.1) !important;
  border-color: var(--primary-color) !important;
}

.product-empty-state {
  border-radius: 1rem;
  padding: 2rem 1rem;
}

.shop-preview-image {
  height: 9rem;
  margin-bottom: 1rem;
  border-radius: 1rem;
  background: linear-gradient(135deg, rgba(var(--primary-color-rgb), 0.25), rgba(var(--accent-color-rgb), 0.2));
  background-position: center;
  background-size: cover;
}

.shop-preview-tag {
  display: inline-flex;
  border-radius: 9999px;
  padding: 0.25rem 0.5rem;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--primary-color);
  background: rgba(var(--primary-color-rgb), 0.1);
  border: 1px solid rgba(var(--primary-color-rgb), 0.35);
}

.gaming-mode-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: minmax(15rem, 1.4fr) repeat(3, minmax(0, 1fr));
}

.gaming-mode-grid__intro,
.gaming-mode-card {
  min-height: 7rem;
  padding: 1.1rem;
  border: 1px solid var(--border-color);
  background: var(--panel-color);
  border-radius: 1.25rem;
}

.gaming-mode-grid__intro { background: linear-gradient(135deg, rgba(var(--primary-color-rgb), 0.12), var(--panel-color)); }

.gaming-mode-card {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.7rem;
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.gaming-mode-card:hover { transform: translateY(-3px); border-color: var(--primary-color); }
.gaming-mode-card--accent:hover { border-color: var(--accent-color); }

.gaming-mode-card__icon {
  display: grid;
  width: 2.3rem;
  height: 2.3rem;
  place-items: center;
  color: var(--bg-color);
  background: var(--primary-color);
  border-radius: 0.9rem;
}

.gaming-mode-card--accent .gaming-mode-card__icon { background: var(--accent-color); }
.gaming-mode-card--neutral .gaming-mode-card__icon { background: var(--text-color); }

.gaming-mode-card__arrow {
  position: absolute;
  top: 1.1rem;
  right: 1.1rem;
  color: var(--muted-color);
}

@media (max-width: 900px) {
  .gaming-mode-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .gaming-mode-grid__intro { grid-column: 1 / -1; }
}

@media (max-width: 520px) {
  .gaming-mode-grid { grid-template-columns: 1fr; }
}

.pole-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  margin-bottom: 1.25rem;
  border-radius: 1rem;
  color: var(--bg-color);
  background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
}

.event-mini-card {
  border-radius: 1rem;
  padding: 1rem;
  background: rgba(var(--primary-color-rgb), 0.035);
  border: 1px solid var(--border-color);
}

</style>
