<script setup lang="ts">
/**
 * CommuMemberDetail — fiche détaillée d'un membre, ouverte depuis l'annuaire.
 *
 * C'est le « clic utile » des cartes : le visiteur voit la bio complète, les
 * statistiques d'activité du membre, puis peut soit filtrer son pôle, soit
 * lire ses annonces. Aucune donnée privée (email, téléphone) n'est rendue.
 */
type MemberLike = {
  id: string
  pseudo: string
  pole: string | null
  level: string
  ranking: number
  avatar: string | null
  bio: string | null
}

const props = withDefaults(defineProps<{
  open: boolean
  member: MemberLike | null
  poleLabel?: string | null
  /** Multi-pôles : tous les libellés à afficher en badges. */
  poleLabels?: string[]
  arrivalPosition?: number | null
  totalMembers?: number
  /** Nombre d'annonces publiées par ce membre. */
  postCount?: number
  /** Réactions reçues sur ses annonces (likes + commentaires). */
  reactionCount?: number
  /** Libellé relatif de sa dernière annonce. */
  lastPostLabel?: string | null
}>(), {
  poleLabel: null,
  poleLabels: () => [],
  arrivalPosition: null,
  totalMembers: 0,
  postCount: 0,
  reactionCount: 0,
  lastPostLabel: null
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  /** Filtrer l'annuaire sur le pôle du membre. */
  pole: []
  /** Afficher les annonces de ce membre dans l'onglet Annonces. */
  posts: []
}>()

const seniorityLabel = computed(() => {
  const position = props.arrivalPosition
  if (!position) return 'Ancienneté non renseignée'
  return `${position}ᵉ inscrit du club`
})

const bio = computed(() => props.member?.bio?.trim() || '')

/** Badges de pôles : la liste complète, ou au minimum le libellé reçu. */
const poleBadges = computed(() => {
  if (props.poleLabels.length > 0) return props.poleLabels
  const fallback = (props.poleLabel || props.member?.pole || '').trim()
  return fallback ? [fallback] : []
})

/** Texte d'en-tête (description du modal) : les pôles à la suite. */
const poleDescription = computed(() => poleBadges.value.join(' · ') || 'Pôle non renseigné')

function close() {
  emit('update:open', false)
}
</script>

<template>
  <UModal
    :open="open"
    :title="member ? `Fiche de ${member.pseudo}` : 'Fiche membre'"
    :description="member ? poleDescription : undefined"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div
        v-if="member"
        class="commu-detail"
      >
        <div class="commu-detail__ident">
          <CommuAvatar
            :name="member.pseudo"
            :src="member.avatar"
            size="lg"
          />
          <div class="commu-detail__ident-text">
            <p class="commu-detail__pseudo">
              {{ member.pseudo }}
            </p>
            <p class="commu-detail__pole">
              {{ poleDescription }}
            </p>
            <div
              v-if="poleBadges.length"
              class="commu-detail__poles"
            >
              <UBadge
                v-for="label in poleBadges"
                :key="label"
                color="neutral"
                variant="soft"
                size="sm"
              >
                {{ label }}
              </UBadge>
            </div>
          </div>
        </div>

        <div class="commu-detail__badges">
          <UBadge
            color="primary"
            variant="soft"
            size="sm"
          >
            {{ member.level || 'Crew' }}
          </UBadge>
          <UBadge
            color="neutral"
            variant="soft"
            size="sm"
            icon="i-lucide-trophy"
          >
            {{ seniorityLabel }}
          </UBadge>
        </div>

        <div class="commu-detail__stats">
          <div class="commu-detail__stat">
            <span class="commu-detail__stat-value">{{ postCount }}</span>
            <span class="commu-detail__stat-label">Annonce(s)</span>
          </div>
          <div class="commu-detail__stat">
            <span class="commu-detail__stat-value">{{ reactionCount }}</span>
            <span class="commu-detail__stat-label">Réaction(s) reçue(s)</span>
          </div>
          <div class="commu-detail__stat">
            <span class="commu-detail__stat-value">{{ totalMembers }}</span>
            <span class="commu-detail__stat-label">Membre(s) au total</span>
          </div>
        </div>

        <div class="commu-detail__bio">
          <p class="commu-detail__section">
            Présentation
          </p>
          <p
            v-if="bio"
            class="commu-detail__bio-text"
          >
            {{ bio }}
          </p>
          <p
            v-else
            class="commu-detail__bio-text commu-detail__bio-text--empty"
          >
            Ce membre n'a pas encore écrit de présentation.
          </p>
        </div>

        <p
          v-if="lastPostLabel"
          class="commu-detail__last"
        >
          <UIcon
            name="i-lucide-clock"
            class="h-3.5 w-3.5"
          />
          Dernière annonce {{ lastPostLabel }}
        </p>

        <div class="commu-detail__actions">
          <UButton
            color="primary"
            icon="i-lucide-users-round"
            :label="`Voir le pôle ${poleBadges[0] || ''}`.trim()"
            block
            @click="emit('pole')"
          />
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-megaphone"
            label="Voir ses annonces"
            block
            @click="emit('posts')"
          />
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            label="Fermer"
            block
            @click="close"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.commu-detail {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.commu-detail__ident {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  min-width: 0;
}

.commu-detail__ident-text {
  min-width: 0;
}

.commu-detail__pseudo {
  overflow-wrap: anywhere;
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--text-color);
}

.commu-detail__pole {
  margin-top: 0.15rem;
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent-color);
}

/* Multi-pôles : badges empilés sous le pseudo. */
.commu-detail__poles {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.4rem;
}

.commu-detail__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.commu-detail__stats {
  display: grid;
  gap: 0.6rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.commu-detail__stat {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.7rem 0.6rem;
  border: 1px solid var(--border-color);
  border-radius: 0.8rem;
  background: rgba(var(--primary-color-rgb), 0.06);
  text-align: center;
}

.commu-detail__stat-value {
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 900;
  color: var(--text-color);
}

.commu-detail__stat-label {
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted-color);
}

.commu-detail__section {
  margin-bottom: 0.35rem;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--primary-color);
}

.commu-detail__bio-text {
  font-size: 0.88rem;
  line-height: 1.6;
  overflow-wrap: anywhere;
  color: var(--text-color);
}

.commu-detail__bio-text--empty {
  font-style: italic;
  color: var(--muted-color);
}

.commu-detail__last {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: var(--muted-color);
}

.commu-detail__actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
