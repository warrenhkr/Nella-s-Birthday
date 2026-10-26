<script setup lang="ts">
/**
 * CommuPostCard — publication / annonce de la communauté.
 * L'auteur, le pôle et le temps relatif sont fournis par la page
 * (relative côté Communauté, horodatage absolu côté administration).
 */
type PostLike = {
  id: string
  author: {
    id: string
    pseudo: string
    profile: { avatar: string | null } | null
  }
  pole: string
  content: string
  likes: number
  comments: number
  createdAt: string
}

withDefaults(defineProps<{
  post: PostLike
  timeLabel: string
  poleLabel?: string | null
  canModerate?: boolean
  deleting?: boolean
}>(), {
  poleLabel: null,
  canModerate: false,
  deleting: false
})

const emit = defineEmits<{
  like: []
  delete: []
}>()
</script>

<template>
  <article class="commu-post clip-corner">
    <header class="commu-post__head">
      <CommuAvatar
        :name="post.author.pseudo"
        :src="post.author.profile?.avatar || null"
        size="md"
      />
      <div class="commu-post__ident">
        <p class="commu-post__author">
          {{ post.author.pseudo }}
        </p>
        <p class="commu-post__time">
          <UIcon
            name="i-lucide-clock"
            class="h-3.5 w-3.5"
          />
          {{ timeLabel }}
        </p>
      </div>
      <UBadge
        color="primary"
        variant="soft"
        size="sm"
        class="commu-post__badge"
      >
        {{ poleLabel || post.pole }}
      </UBadge>
    </header>

    <RichTextContent
      class="commu-post__content"
      :content="post.content"
      :label="`Publication de ${post.author.pseudo}`"
    />

    <footer class="commu-post__foot">
      <button
        type="button"
        class="commu-post__action"
        :aria-label="`Aimer la publication de ${post.author.pseudo}`"
        @click="emit('like')"
      >
        <UIcon
          name="i-lucide-heart"
          class="h-4 w-4"
        />
        {{ post.likes }}
      </button>
      <span class="commu-post__stat">
        <UIcon
          name="i-lucide-message-circle"
          class="h-4 w-4"
        />
        {{ post.comments }}
      </span>
      <UButton
        v-if="canModerate"
        class="commu-post__delete"
        color="error"
        variant="ghost"
        size="xs"
        icon="i-lucide-trash-2"
        aria-label="Supprimer la publication"
        :loading="deleting"
        @click="emit('delete')"
      />
    </footer>
  </article>
</template>

<style scoped>
.commu-post {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1.1rem;
  border: 1px solid var(--border-color);
  background: var(--panel-color);
  transition: border-color 0.18s ease;
}

.commu-post:hover {
  border-color: rgba(var(--primary-color-rgb), 0.4);
}

.commu-post__head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.commu-post__ident {
  min-width: 0;
}

.commu-post__author {
  overflow: hidden;
  font-weight: 700;
  color: var(--text-color);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.commu-post__time {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.1rem;
  font-size: 0.7rem;
  color: var(--muted-color);
}

.commu-post__badge {
  margin-left: auto;
  flex: 0 0 auto;
  text-transform: uppercase;
}

.commu-post__content {
  /* Le contenu est du HTML nettoyé (paragraphes/listes) : `pre-wrap` ferait
     apparaître les retours à la ligne du balisage comme des lignes vides. */
  white-space: normal;
  overflow-wrap: anywhere;
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--text-color);
}

.commu-post__foot {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color);
}

.commu-post__action,
.commu-post__stat {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--muted-color);
}

.commu-post__action {
  padding: 0.2rem 0.45rem;
  border: 1px solid transparent;
  border-radius: 9999px;
  cursor: pointer;
  transition: color 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;
}

.commu-post__action:hover {
  color: var(--primary-color);
  border-color: rgba(var(--primary-color-rgb), 0.4);
  background: rgba(var(--primary-color-rgb), 0.1);
}

.commu-post__delete {
  margin-left: auto;
}
</style>
