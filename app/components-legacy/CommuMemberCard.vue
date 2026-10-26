<script setup lang="ts">
/**
 * CommuMemberCard — carte de membre de l'annuaire.
 *
 * Trois zones utiles, dans cet ordre :
 *   1. en-tête cliquable (avatar + pseudo) → ouvre la fiche détaillée ;
 *   2. corps : pôle, niveau, ancienneté, bio tronquée ;
 *   3. pied : action « Voir le pôle » (lien vers l'équipe/pôle du membre).
 *
 * Aucun email ni téléphone n'est affiché : l'API publique ne les expose pas
 * et cette carte ne rend que pseudo / pôle / niveau / avatar / bio.
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
  member: MemberLike
  poleLabel?: string | null
  /** Multi-pôles : tous les libellés à afficher en badges. */
  poleLabels?: string[]
  /** Position d'arrivée (1 = premier inscrit du club). */
  arrivalPosition?: number | null
  /** Nombre total de membres (pour repérer le plus récent). */
  totalMembers?: number
  highlighted?: boolean
  /** Conservé pour la compatibilité : classement brut renvoyé par l'API. */
  rank?: number | null
  /** Désactive le clic d'ouverture (ex. rendu en démo). */
  openable?: boolean
}>(), {
  poleLabel: null,
  poleLabels: () => [],
  arrivalPosition: null,
  totalMembers: 0,
  highlighted: false,
  rank: null,
  openable: true
})

const emit = defineEmits<{
  /** Le visiteur veut la fiche complète du membre. */
  open: []
  /** Le visiteur veut ne voir que les membres de ce pôle. */
  pole: []
}>()

/** Libellé d'ancienneté : « Pionnier » pour les 3 plus anciens, « Nouveau » pour les derniers. */
const seniority = computed(() => {
  const position = props.arrivalPosition ?? 0
  if (position <= 0) return { label: 'Ancienneté inconnue', tone: 'neutral' as const }
  if (position <= 3) return { label: `Pionnier · #${position}`, tone: 'primary' as const }
  if (props.totalMembers >= 4 && position >= props.totalMembers - 1) {
    return { label: `Nouveau · #${position}`, tone: 'accent' as const }
  }
  return { label: `Arrivée · #${position}`, tone: 'neutral' as const }
})

/** Badges de pôles : la liste complète, ou au minimum le libellé reçu. */
const poleBadges = computed(() => {
  if (props.poleLabels.length > 0) return props.poleLabels
  const fallback = (props.poleLabel || props.member.pole || '').trim()
  return fallback ? [fallback] : []
})
</script>

<template>
  <article
    class="commu-member clip-corner"
    :class="{ 'commu-member--highlight': highlighted }"
  >
    <button
      type="button"
      class="commu-member__open"
      :disabled="!openable"
      :aria-label="`Ouvrir la fiche de ${member.pseudo}`"
      @click="emit('open')"
    >
      <CommuAvatar
        :name="member.pseudo"
        :src="member.avatar"
        size="lg"
      />
      <span class="commu-member__ident">
        <span class="commu-member__name">{{ member.pseudo }}</span>
        <span
          v-if="poleBadges.length"
          class="commu-member__poles"
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
        </span>
        <span
          v-else
          class="commu-member__pole"
        >Pôle non renseigné</span>
      </span>
      <UIcon
        v-if="openable"
        name="i-lucide-chevron-right"
        class="commu-member__chevron"
        aria-hidden="true"
      />
    </button>

    <p
      v-if="member.bio"
      class="commu-member__bio"
    >
      {{ member.bio }}
    </p>
    <p
      v-else
      class="commu-member__bio commu-member__bio--empty"
    >
      Pas encore de bio — ce membre n'a rien raconté de son univers.
    </p>

    <footer class="commu-member__foot">
      <UBadge
        color="primary"
        variant="soft"
        size="sm"
      >
        {{ member.level || 'Crew' }}
      </UBadge>
      <span
        class="commu-member__rank"
        :title="`Ordre d'arrivée dans le club (${arrivalPosition ?? member.ranking}ᵉ inscrit)`"
      >
        <UIcon
          name="i-lucide-trophy"
          class="h-3.5 w-3.5"
        />
        {{ seniority.label }}
      </span>
    </footer>

    <UButton
      color="neutral"
      variant="soft"
      size="sm"
      block
      icon="i-lucide-users-round"
      :label="`Voir le pôle ${poleLabel || 'du membre'}`"
      @click="emit('pole')"
    />
  </article>
</template>

<style scoped>
.commu-member {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  min-width: 0;
  height: 100%;
  padding: 1.1rem;
  border: 1px solid var(--border-color);
  background: var(--panel-color);
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.commu-member:hover {
  border-color: rgba(var(--primary-color-rgb), 0.45);
  transform: translateY(-2px);
  box-shadow: var(--shadow-glow);
}

.commu-member--highlight {
  border-color: var(--primary-color);
}

/* En-tête cliquable : toute la zone avatar + pseudo ouvre la fiche. */
.commu-member__open {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: 0.75rem;
  text-align: left;
  background: transparent;
  cursor: pointer;
}

.commu-member__open:disabled {
  cursor: default;
}

.commu-member__open:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.35);
}

.commu-member__ident {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* Multi-pôles : badges empilés, lisibles dès 375 px. */
.commu-member__poles {
  display: flex;
  flex-wrap: wrap;
  gap: 0.22rem;
  margin-top: 0.3rem;
}

.commu-member__name {
  overflow: hidden;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-color);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.commu-member__pole {
  margin-top: 0.15rem;
  overflow: hidden;
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent-color);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.commu-member__chevron {
  flex: 0 0 auto;
  width: 1.1rem;
  height: 1.1rem;
  margin-left: auto;
  color: var(--muted-color);
  transition: transform 0.18s ease, color 0.18s ease;
}

.commu-member__open:hover .commu-member__chevron {
  color: var(--primary-color);
  transform: translateX(2px);
}

.commu-member__bio {
  display: -webkit-box;
  overflow: hidden;
  font-size: 0.82rem;
  line-height: 1.5;
  color: var(--text-color);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.commu-member__bio--empty {
  font-style: italic;
  color: var(--muted-color);
}

.commu-member__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color);
}

.commu-member__rank {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.06em;
  color: var(--muted-color);
}
</style>
