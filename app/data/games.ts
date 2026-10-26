export type GameDefinition = {
  id: string
  title: string
  description: string
  icon: string
  accent: string
}

export const games: GameDefinition[] = [
  {
    id: 'memory-game',
    title: 'Memory of Love',
    description: 'Retrouve les paires de souvenirs et gagne le cœur.',
    icon: 'i-lucide-sparkles',
    accent: 'rose'
  },
  {
    id: 'terminal-puzzle',
    title: 'Terminal Puzzle',
    description: 'Tape les bonnes commandes pour déverrouiller le message secret.',
    icon: 'i-lucide-terminal-square',
    accent: 'violet'
  },
  {
    id: 'love-quiz',
    title: 'Love Quiz',
    description: 'Réponds à quelques questions pour prouver que tu connais bien le cœur.',
    icon: 'i-lucide-brain-circuit',
    accent: 'magique'
  },
  {
    id: 'heart-tap',
    title: 'Heart Tap',
    description: 'Clique le plus vite possible pour remplir le cœur de gestes tendres.',
    icon: 'i-lucide-heart',
    accent: 'rapide'
  },
  {
    id: 'constellation-studio',
    title: 'Constellation Studio',
    description: 'Relie les étoiles et invente ton propre dessin dans le ciel.',
    icon: 'i-lucide-orbit',
    accent: 'création libre'
  },
  {
    id: 'orbit-landing',
    title: 'Vise l’orbite',
    description: 'Lance ton étoile au bon moment pour l’envoyer sur la bonne orbite.',
    icon: 'i-lucide-target',
    accent: 'précision'
  },
  {
    id: 'phishing-detective',
    title: 'Phishing Detective',
    description: 'Repère les indices d’un message frauduleux avant qu’il ne te piège.',
    icon: 'i-lucide-shield-alert',
    accent: 'cybersécurité'
  },
  {
    id: 'password-lab',
    title: 'Password Lab',
    description: 'Choisis des habitudes qui rendent les comptes plus difficiles à compromettre.',
    icon: 'i-lucide-key-round',
    accent: 'identité numérique'
  },
  {
    id: 'cipher-breaker',
    title: 'Cipher Breaker',
    description: 'Déchiffre de petits codes et découvre les bases de la cryptographie.',
    icon: 'i-lucide-scan-search',
    accent: 'cryptographie'
  }
]
