// ============================================================
// Restaure le choix audio de l'utilisateur sans lancer de lecture au chargement.
// AudioToggle démarre la musique depuis un geste explicite, requis par les navigateurs.
// ============================================================
export default defineNuxtPlugin(() => {
  if (!import.meta.client) return

  useSoundManager().hydrateMuteState()
})
