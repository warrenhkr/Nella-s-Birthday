<script setup lang="ts">
/**
 * CommuActivityStrip — bandeau « ça bouge » permanent en haut de la page.
 *
 * Trois signaux d'activité, courts et cliquables, pour que la page ait de la
 * valeur dès l'arrivée, sans descendre dans les onglets :
 *   • les derniers inscrits (qui vient d'arriver) ;
 *   • les pôles les plus actifs (où se passe la vie du club) ;
 *   • les dernières annonces (quoi de neuf).
 */
type MiniMember = {
  id: string
  pseudo: string
  avatar: string | null
  poleLabel: string
}

type MiniPole = {
  slug: string
  label: string
  icon: string
  memberCount: number
  postCount: number
}

type MiniPost = {
  id: string
  pseudo: string
  avatar: string | null
  poleLabel: string
  excerpt: string
  timeLabel: string
}

withDefaults(defineProps<{
  recentMembers?: MiniMember[]
  topPoles?: MiniPole[]
  recentPosts?: MiniPost[]
  loading?: boolean
}>(), {
  recentMembers: () => [],
  topPoles: () => [],
  recentPosts: () => [],
  loading: false
})

const emit = defineEmits<{
  /** Ouvrir la fiche d'un membre récent. */
  'select-member': [id: string]
  /** Filtrer l'annuaire sur un pôle actif. */
  'select-pole': [slug: string]
  /** Aller à l'onglet Annonces. */
  'open-posts': []
}>()
</script>

<template>
  <section
    class="commu-activity"
    aria-label="Activité récente de la communauté"
  >
    <!-- Derniers inscrits -->
    <article class="commu-activity__card clip-corner-sm">
      <p class="commu-activity__eyebrow">
        <UIcon
          name="i-lucide-user-plus"
          class="h-3.5 w-3.5"
        />
        Derniers inscrits
      </p>

      <div
        v-if="loading"
        class="commu-activity__skeletons"
      >
        <USkeleton
          v-for="index in 3"
          :key="index"
          class="h-8 w-full rounded-lg"
        />
      </div>
      <ul
        v-else-if="recentMembers.length > 0"
        class="commu-activity__list"
      >
        <li
          v-for="member in recentMembers"
          :key="member.id"
        >
          <button
            type="button"
            class="commu-activity__row"
            @click="emit('select-member', member.id)"
          >
            <CommuAvatar
              :name="member.pseudo"
              :src="member.avatar"
              size="sm"
            />
            <span class="commu-activity__row-text">
              <span class="commu-activity__row-title">{{ member.pseudo }}</span>
              <span class="commu-activity__row-sub">{{ member.poleLabel }}</span>
            </span>
          </button>
        </li>
      </ul>
      <p
        v-else
        class="commu-activity__empty"
      >
        Aucun membre inscrit pour l'instant.
      </p>
    </article>

    <!-- Pôles les plus actifs -->
    <article class="commu-activity__card clip-corner-sm">
      <p class="commu-activity__eyebrow">
        <UIcon
          name="i-lucide-flame"
          class="h-3.5 w-3.5"
        />
        Pôles les plus actifs
      </p>

      <div
        v-if="loading"
        class="commu-activity__skeletons"
      >
        <USkeleton
          v-for="index in 3"
          :key="index"
          class="h-8 w-full rounded-lg"
        />
      </div>
      <ul
        v-else-if="topPoles.length > 0"
        class="commu-activity__list"
      >
        <li
          v-for="pole in topPoles"
          :key="pole.slug"
        >
          <button
            type="button"
            class="commu-activity__row"
            @click="emit('select-pole', pole.slug)"
          >
            <span class="commu-activity__pole-icon">
              <UIcon
                :name="pole.icon"
                class="h-4 w-4"
              />
            </span>
            <span class="commu-activity__row-text">
              <span class="commu-activity__row-title">{{ pole.label }}</span>
              <span class="commu-activity__row-sub">
                {{ pole.memberCount }} membre(s) · {{ pole.postCount }} annonce(s)
              </span>
            </span>
          </button>
        </li>
      </ul>
      <p
        v-else
        class="commu-activity__empty"
      >
        Aucun pôle actif pour le moment.
      </p>
    </article>

    <!-- Dernières annonces -->
    <article class="commu-activity__card clip-corner-sm">
      <p class="commu-activity__eyebrow">
        <UIcon
          name="i-lucide-megaphone"
          class="h-3.5 w-3.5"
        />
        Dernières annonces
      </p>

      <div
        v-if="loading"
        class="commu-activity__skeletons"
      >
        <USkeleton
          v-for="index in 2"
          :key="index"
          class="h-10 w-full rounded-lg"
        />
      </div>
      <ul
        v-else-if="recentPosts.length > 0"
        class="commu-activity__list"
      >
        <li
          v-for="post in recentPosts"
          :key="post.id"
        >
          <button
            type="button"
            class="commu-activity__row commu-activity__row--post"
            @click="emit('open-posts')"
          >
            <CommuAvatar
              :name="post.pseudo"
              :src="post.avatar"
              size="sm"
              tone="accent"
            />
            <span class="commu-activity__row-text">
              <span class="commu-activity__row-title">{{ post.excerpt }}</span>
              <span class="commu-activity__row-sub">
                {{ post.pseudo }} · {{ post.poleLabel }} · {{ post.timeLabel }}
              </span>
            </span>
          </button>
        </li>
      </ul>
      <p
        v-else
        class="commu-activity__empty"
      >
        Le fil est encore vide.
      </p>
    </article>
  </section>
</template>

<style scoped>
.commu-activity {
  display: grid;
  gap: 0.75rem;
  margin-top: 1.25rem;
  grid-template-columns: 1fr;
}

.commu-activity__card {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--border-color);
  background: var(--panel-color);
}

.commu-activity__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--accent-color);
}

.commu-activity__list {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.commu-activity__row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  min-width: 0;
  padding: 0.35rem 0.4rem;
  border: 1px solid transparent;
  border-radius: 0.7rem;
  text-align: left;
  background: transparent;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease;
}

.commu-activity__row:hover {
  border-color: rgba(var(--primary-color-rgb), 0.35);
  background: rgba(var(--primary-color-rgb), 0.08);
}

.commu-activity__row:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.3);
}

.commu-activity__row-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.commu-activity__row-title {
  overflow: hidden;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-color);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.commu-activity__row--post .commu-activity__row-title {
  display: -webkit-box;
  white-space: normal;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.commu-activity__row-sub {
  overflow: hidden;
  font-size: 0.7rem;
  color: var(--muted-color);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.commu-activity__pole-icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.6rem;
  border: 1px solid rgba(var(--accent-color-rgb), 0.3);
  color: var(--accent-color);
  background: rgba(var(--accent-color-rgb), 0.12);
}

.commu-activity__empty {
  font-size: 0.75rem;
  font-style: italic;
  color: var(--muted-color);
}

.commu-activity__skeletons {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

@media (min-width: 768px) {
  .commu-activity {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
