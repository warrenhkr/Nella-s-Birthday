<script setup lang="ts">
export type CyberGameId = 'phishing-detective' | 'password-lab' | 'cipher-breaker'

type AnswerOption = {
  label: string
  correct: boolean
}

type ChallengeQuestion = {
  prompt: string
  options: AnswerOption[]
  explanation: string
}

const props = defineProps<{ gameId: CyberGameId }>()
const emit = defineEmits<{ (event: 'score', value: number): void }>()

const challengeBank: Record<CyberGameId, ChallengeQuestion[]> = {
  'phishing-detective': [
    {
      prompt: 'Un message annonce que ton compte sera fermé dans 10 minutes et demande ton mot de passe via un lien. Quel est le meilleur réflexe ?',
      options: [
        { label: 'Cliquer vite pour éviter la fermeture', correct: false },
        { label: 'Ne pas cliquer et vérifier depuis le site officiel', correct: true },
        { label: 'Répondre au message avec ton mot de passe', correct: false }
      ],
      explanation: 'L’urgence et la demande de secret sont des signaux d’alerte. Ouvre toi-même l’application ou le site officiel.'
    },
    {
      prompt: 'Une adresse ressemble à support@banque-securite.example.net. Que vérifies-tu en premier ?',
      options: [
        { label: 'Le domaine réel après le dernier point', correct: true },
        { label: 'La couleur du logo', correct: false },
        { label: 'Le nombre de lignes du message', correct: false }
      ],
      explanation: 'Un sous-domaine peut imiter une marque. Il faut vérifier le domaine réellement contrôlé et ne pas se fier au logo.'
    },
    {
      prompt: 'Un collègue t’envoie une pièce jointe inattendue qui demande d’activer les macros. Que fais-tu ?',
      options: [
        { label: 'L’activer si le nom du collègue est connu', correct: false },
        { label: 'Confirmer la demande par un autre canal', correct: true },
        { label: 'La transférer à toute l’équipe', correct: false }
      ],
      explanation: 'Un compte peut être usurpé ou compromis. Confirme l’envoi par un canal déjà connu, sans ouvrir le fichier.'
    },
    {
      prompt: 'Le cadenas HTTPS suffit-il à prouver qu’un site est légitime ?',
      options: [
        { label: 'Oui, HTTPS certifie que le site est honnête', correct: false },
        { label: 'Non, il chiffre la connexion mais pas la confiance', correct: true },
        { label: 'Oui, s’il y a aussi une bannière colorée', correct: false }
      ],
      explanation: 'HTTPS protège le transport des données, mais un site d’hameçonnage peut aussi l’utiliser.'
    }
  ],
  'password-lab': [
    {
      prompt: 'Quelle stratégie protège le mieux tes comptes ?',
      options: [
        { label: 'Le même mot de passe long partout', correct: false },
        { label: 'Un mot de passe unique par compte, stocké dans un gestionnaire', correct: true },
        { label: 'Le prénom suivi de l’année en cours', correct: false }
      ],
      explanation: 'Des secrets uniques limitent les dégâts si un service subit une fuite. Un gestionnaire aide à les retenir.'
    },
    {
      prompt: 'Un service propose l’authentification à deux facteurs. Quel choix est préférable ?',
      options: [
        { label: 'L’activer, idéalement avec une clé ou une application dédiée', correct: true },
        { label: 'Désactiver les alertes de connexion', correct: false },
        { label: 'Partager les codes de secours avec ses contacts', correct: false }
      ],
      explanation: 'Un second facteur réduit le risque lié au vol d’un mot de passe. Garde les codes de secours confidentiels.'
    },
    {
      prompt: 'Tu reçois un code de connexion que tu n’as pas demandé. Que fais-tu ?',
      options: [
        { label: 'Le donner au support qui appelle', correct: false },
        { label: 'Ne pas le partager et sécuriser le compte depuis l’application officielle', correct: true },
        { label: 'Le publier pour demander conseil', correct: false }
      ],
      explanation: 'Les codes de connexion sont des secrets. Un support légitime ne devrait pas te demander de les dicter.'
    },
    {
      prompt: 'Après avoir utilisé un ordinateur partagé, quel geste est le plus sûr ?',
      options: [
        { label: 'Enregistrer le mot de passe pour la prochaine personne', correct: false },
        { label: 'Se déconnecter et ne pas enregistrer le secret', correct: true },
        { label: 'Laisser l’onglet ouvert', correct: false }
      ],
      explanation: 'Déconnecte-toi et refuse l’enregistrement des identifiants sur un appareil partagé.'
    }
  ],
  'cipher-breaker': [
    {
      prompt: 'Avec un décalage de César de 3 vers l’arrière, que devient KHOOR ?',
      options: [
        { label: 'HELLO', correct: true },
        { label: 'WORLD', correct: false },
        { label: 'SECURE', correct: false }
      ],
      explanation: 'Chaque lettre recule de trois rangs : K devient H, H devient E, et ainsi de suite.'
    },
    {
      prompt: 'La clé de chiffrement est le décalage. Que faut-il pour déchiffrer un message César ?',
      options: [
        { label: 'Connaître ou retrouver le décalage utilisé', correct: true },
        { label: 'Connaître la couleur du clavier', correct: false },
        { label: 'Ajouter toujours trois lettres', correct: false }
      ],
      explanation: 'La clé indique la transformation. Un chiffrement César est pédagogique, mais trop faible pour protéger des données réelles.'
    },
    {
      prompt: 'Quel est le principal défaut du chiffrement César ?',
      options: [
        { label: 'Il est trop facile à casser par essai ou analyse', correct: true },
        { label: 'Il ne fonctionne qu’avec des nombres pairs', correct: false },
        { label: 'Il efface les fichiers après lecture', correct: false }
      ],
      explanation: 'Il n’a que 25 décalages possibles. Les systèmes modernes utilisent des algorithmes robustes et des clés bien plus complexes.'
    },
    {
      prompt: 'Tu reçois un message chiffré. Lequel est un bon principe de sécurité ?',
      options: [
        { label: 'Utiliser des méthodes reconnues et protéger la clé', correct: true },
        { label: 'Inventer un chiffrement maison pour la banque', correct: false },
        { label: 'Envoyer la clé dans le même message en clair', correct: false }
      ],
      explanation: 'La cryptographie réelle s’appuie sur des méthodes analysées publiquement et une gestion prudente des clés.'
    }
  ]
}

const quiz = computed(() => challengeBank[props.gameId])
const questionIndex = ref(0)
const score = ref(0)
const selectedIndex = ref<number | null>(null)
const isComplete = computed(() => questionIndex.value >= quiz.value.length)
const currentQuestion = computed(() => quiz.value[questionIndex.value] ?? null)
const selectedOption = computed(() => selectedIndex.value === null ? null : currentQuestion.value?.options[selectedIndex.value] ?? null)

function chooseAnswer(index: number) {
  if (selectedIndex.value !== null || !currentQuestion.value) return

  selectedIndex.value = index
  if (currentQuestion.value.options[index]?.correct) {
    score.value += 1
    emit('score', score.value)
  }
}

function nextQuestion() {
  if (selectedIndex.value === null) return
  questionIndex.value += 1
  selectedIndex.value = null
}

function restart() {
  questionIndex.value = 0
  score.value = 0
  selectedIndex.value = null
  emit('score', 0)
}
</script>

<template>
  <section class="cyber-quiz" :aria-label="props.gameId">
    <div v-if="currentQuestion" class="cyber-quiz__panel">
      <div class="cyber-quiz__meta">
        <span><UIcon name="i-lucide-shield-check" /> Défi {{ questionIndex + 1 }} / {{ quiz.length }}</span>
        <span>{{ score }} point{{ score > 1 ? 's' : '' }}</span>
      </div>

      <div class="cyber-quiz__progress" role="progressbar" :aria-valuenow="questionIndex + 1" :aria-valuemax="quiz.length">
        <span :style="{ width: `${((questionIndex + 1) / quiz.length) * 100}%` }" />
      </div>

      <h2>{{ currentQuestion.prompt }}</h2>

      <div class="cyber-quiz__options">
        <button
          v-for="(option, index) in currentQuestion.options"
          :key="option.label"
          type="button"
          :disabled="selectedIndex !== null"
          :class="{
            'is-correct': selectedIndex !== null && option.correct,
            'is-wrong': selectedIndex === index && !option.correct
          }"
          @click="chooseAnswer(index)"
        >
          <span class="cyber-quiz__option-index">0{{ index + 1 }}</span>
          <span>{{ option.label }}</span>
          <UIcon v-if="selectedIndex !== null && option.correct" name="i-lucide-check" />
          <UIcon v-else-if="selectedIndex === index" name="i-lucide-x" />
        </button>
      </div>

      <Transition name="quiz-feedback">
        <div v-if="selectedOption" class="cyber-quiz__feedback" aria-live="polite">
          <p>{{ selectedOption.correct ? 'Bien vu.' : 'Pas tout à fait.' }}</p>
          <span>{{ currentQuestion.explanation }}</span>
          <button type="button" @click="nextQuestion">
            {{ questionIndex + 1 === quiz.length ? 'Voir le résultat' : 'Défi suivant' }}
            <UIcon name="i-lucide-arrow-right" />
          </button>
        </div>
      </Transition>
    </div>

    <div v-else class="cyber-quiz__result" aria-live="polite">
      <span class="cyber-quiz__result-icon"><UIcon name="i-lucide-shield-check" /></span>
      <p class="cyber-quiz__result-label">Mission terminée</p>
      <h2>{{ score }} / {{ quiz.length }}</h2>
      <p>{{ score === quiz.length ? 'Belle maîtrise des réflexes de sécurité.' : 'Chaque défi t’a donné un nouveau réflexe utile.' }}</p>
      <button type="button" @click="restart"><UIcon name="i-lucide-rotate-ccw" /> Rejouer</button>
    </div>
  </section>
</template>

<style scoped>
.cyber-quiz {
  color: var(--text-color);
}

.cyber-quiz__panel,
.cyber-quiz__result {
  max-width: 46rem;
  margin-inline: auto;
  padding: 1.25rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: var(--theme-panel);
}

.cyber-quiz__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: var(--muted-color);
  font-size: 0.75rem;
}

.cyber-quiz__meta span:first-child {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--primary-color);
}

.cyber-quiz__meta :deep(svg) { width: 1rem; height: 1rem; }

.cyber-quiz__progress {
  height: 0.3rem;
  margin-top: 0.85rem;
  overflow: hidden;
  border-radius: 1rem;
  background: var(--theme-soft-primary);
}

.cyber-quiz__progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--primary-color), var(--accent-color));
  transition: width 350ms ease;
}

.cyber-quiz__panel h2 {
  margin-top: 1.35rem;
  color: var(--text-color);
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1.55;
}

.cyber-quiz__options {
  display: grid;
  gap: 0.6rem;
  margin-top: 1.1rem;
}

.cyber-quiz__options button {
  display: grid;
  grid-template-columns: 2rem 1fr auto;
  align-items: center;
  gap: 0.75rem;
  min-height: 3.5rem;
  padding: 0.65rem 0.8rem;
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  background: var(--theme-panel-solid);
  color: var(--text-color);
  text-align: left;
  cursor: pointer;
  transition: border-color 180ms ease, transform 180ms ease, background-color 180ms ease;
}

.cyber-quiz__options button:hover:not(:disabled) {
  transform: translateX(3px);
  border-color: var(--primary-color);
}

.cyber-quiz__options button.is-correct {
  border-color: #43a88b;
  background: color-mix(in srgb, #43a88b 13%, var(--theme-panel-solid));
}

.cyber-quiz__options button.is-wrong {
  border-color: #d47889;
  background: color-mix(in srgb, #d47889 13%, var(--theme-panel-solid));
}

.cyber-quiz__option-index {
  color: var(--accent-color);
  font-family: var(--font-mono);
  font-size: 0.7rem;
}

.cyber-quiz__feedback {
  margin-top: 1rem;
  padding: 0.9rem;
  border-left: 3px solid var(--accent-color);
  border-radius: 0 0.6rem 0.6rem 0;
  background: var(--theme-soft-accent);
}

.cyber-quiz__feedback > p {
  color: var(--primary-color);
  font-size: 0.9rem;
  font-weight: 700;
}

.cyber-quiz__feedback > span {
  display: block;
  margin-top: 0.3rem;
  color: var(--muted-color);
  font-size: 0.82rem;
  line-height: 1.6;
}

.cyber-quiz__feedback button,
.cyber-quiz__result button {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin-top: 0.75rem;
  padding: 0.55rem 0.8rem;
  border: 0;
  border-radius: 999px;
  background: var(--primary-color);
  color: white;
  font-size: 0.8rem;
  font-weight: 650;
  cursor: pointer;
}

.cyber-quiz__feedback button :deep(svg),
.cyber-quiz__result button :deep(svg) { width: 1rem; height: 1rem; }

.cyber-quiz__result {
  display: grid;
  justify-items: center;
  padding-block: 2rem;
  text-align: center;
}

.cyber-quiz__result-icon {
  display: grid;
  width: 3.6rem;
  height: 3.6rem;
  place-items: center;
  border-radius: 50%;
  background: var(--theme-soft-primary);
  color: var(--primary-color);
}

.cyber-quiz__result-icon :deep(svg) { width: 1.8rem; height: 1.8rem; }
.cyber-quiz__result-label { margin-top: 0.8rem; color: var(--accent-color); font-size: 0.72rem; text-transform: uppercase; }
.cyber-quiz__result h2 { margin-top: 0.3rem; color: var(--primary-color); font-size: 2.4rem; }
.cyber-quiz__result > p:last-of-type { margin-top: 0.3rem; color: var(--muted-color); font-size: 0.85rem; }

.quiz-feedback-enter-active,
.quiz-feedback-leave-active { transition: opacity 180ms ease, transform 180ms ease; }
.quiz-feedback-enter-from { opacity: 0; transform: translateY(0.4rem); }
.quiz-feedback-leave-to { opacity: 0; transform: translateY(-0.25rem); }

@media (max-width: 520px) {
  .cyber-quiz__panel,
  .cyber-quiz__result { padding: 0.9rem; }
  .cyber-quiz__panel h2 { font-size: 1.05rem; }
  .cyber-quiz__options button { grid-template-columns: 1.5rem 1fr auto; gap: 0.5rem; font-size: 0.83rem; }
}

@media (prefers-reduced-motion: reduce) {
  .cyber-quiz__progress span,
  .cyber-quiz__options button,
  .quiz-feedback-enter-active,
  .quiz-feedback-leave-active { transition: none; }
}
</style>