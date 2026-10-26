import registry from '../../site-algos/registry.json'
import analystRegistry from '../../lot-analyste-entreprise/registry-analyste.json'

export type AlgoRenderType = 'points' | 'frames' | 'grille' | 'texte' | 'image'
export type AlgoParameterType = 'number' | 'integer' | 'boolean' | 'select' | 'text'

export type AlgoParameter = {
  name: string
  label: string
  type: AlgoParameterType
  min?: number
  max?: number
  default: number | string | boolean
  options?: string[]
}

export type AlgoAnimationMode = {
  id: string
  label: string
  description: string
  speed: number
  params: Record<string, number | string | boolean>
}

export type AlgoDefinition = {
  id: string
  category: 'anniversaire' | 'analyste'
  title: string
  description: string
  tags: string[]
  file: string
  renderType: AlgoRenderType
  parameters: AlgoParameter[]
  animationModes: AlgoAnimationMode[]
}

type RegistryParameter = {
  name: string
  label: string
  type: 'int' | 'float' | 'bool' | 'select' | 'str'
  min?: number
  max?: number
  default: number | string | boolean
  options?: string[]
}

type RegistryEntry = {
  id: string
  doc?: string
  title?: string
  render: 'points' | 'frames' | 'grid' | 'text' | 'image'
  params: RegistryParameter[]
}

const renderTypes: Record<RegistryEntry['render'], AlgoRenderType> = {
  points: 'points',
  frames: 'frames',
  grid: 'grille',
  text: 'texte',
  image: 'image'
}

const animationModesByAlgo: Record<string, AlgoAnimationMode[]> = {
  caesar_love_message: [
    { id: 'unveiling', label: 'Dévoilement lent', description: 'Révèle le message ligne par ligne, à un rythme calme.', speed: 0.65, params: {} },
    { id: 'rhythmic', label: 'Lecture rythmée', description: 'Accélère le déchiffrement sans changer le message.', speed: 1.35, params: {} }
  ],
  fibonacci_sunflower: [
    { id: 'light-turn', label: 'Tour léger et doux', description: 'Une rotation légère avec des points fins.', speed: 0.75, params: { count: 650, size: 2, frames: 24 } },
    { id: 'dense-turn', label: 'Tour dense et vif', description: 'Davantage de graines pour une spirale plus remplie.', speed: 1.25, params: { count: 1450, size: 1.6, frames: 24 } }
  ],
  flood_fill_paint: [
    { id: 'calm-fill', label: 'Remplissage lent', description: 'Une grille plus fine et une propagation facile à suivre.', speed: 0.65, params: { grid_size: 44, walls: 0.04 } },
    { id: 'maze-fill', label: 'Parcours dense', description: 'Plus d’obstacles pour observer la propagation autour des murs.', speed: 1.15, params: { grid_size: 72, walls: 0.16 } }
  ],
  game_of_life_heart: [
    { id: 'quiet-life', label: 'Vie douce', description: 'Une grille légère et moins de générations à suivre.', speed: 0.7, params: { grid_size: 36, steps: 60, initial_density: 0.2 } },
    { id: 'busy-life', label: 'Vie foisonnante', description: 'Plus de cellules et de générations pour un aperçu vivant.', speed: 1.2, params: { grid_size: 56, steps: 180, initial_density: 0.38 } }
  ],
  heart_bloom_trail: [
    { id: 'soft-trail', label: 'Traînée douce', description: 'Une tête lumineuse, une traînée courte et une floraison discrète.', speed: 0.7, params: { heads: 1, trail: 20, frames: 72, size: 2.2, bloom: 0.6 } },
    { id: 'bright-trail', label: 'Floraison vive', description: 'Plusieurs lumières et une traînée plus généreuse.', speed: 1.25, params: { heads: 3, trail: 42, frames: 48, size: 3.5, bloom: 1.6 } }
  ],
  heart_confetti_burst: [
    { id: 'gentle-confetti', label: 'Confettis légers', description: 'Moins de particules et une explosion plus lente.', speed: 0.7, params: { count: 70, power: 6, friction: 0.97, gravity: 0.08, frames: 60, size: 1.8 } },
    { id: 'grand-burst', label: 'Grande explosion', description: 'Une gerbe plus fournie et plus énergique.', speed: 1.2, params: { count: 240, power: 13, friction: 0.92, gravity: 0.16, frames: 72, size: 2.8 } }
  ],
  heart_frame_sequence: [
    { id: 'soft-beat', label: 'Battement apaisé', description: 'Un battement lent avec quelques scintillements.', speed: 0.7, params: { frames: 48, size: 256, sparkles: 6 } },
    { id: 'bright-beat', label: 'Battement scintillant', description: 'Une séquence plus vive, avec davantage d’étincelles.', speed: 1.2, params: { frames: 36, size: 320, sparkles: 28 } }
  ],
  heart_glow_particle_field: [
    { id: 'sparse-glow', label: 'Lueur aérienne', description: 'Moins de particules et une lueur subtile.', speed: 0.75, params: { count: 500, size: 1.2, glow: 0.3, frames: 12 } },
    { id: 'dense-glow', label: 'Halo dense', description: 'Un champ plus rempli, avec une lueur marquée.', speed: 1.2, params: { count: 1250, size: 1.8, glow: 0.8, frames: 12 } }
  ],
  heart_grid_pulse: [
    { id: 'slow-wave', label: 'Onde lente', description: 'Une onde ample et progressive dans une grille légère.', speed: 0.65, params: { grid_size: 36, frames: 48, wavelength: 11 } },
    { id: 'quick-pulse', label: 'Pulsation rapide', description: 'Une grille plus détaillée avec des pulsations rapprochées.', speed: 1.25, params: { grid_size: 64, frames: 30, wavelength: 6 } }
  ],
  heart_pulse_points: [
    { id: 'gentle-pulse', label: 'Pulsation douce', description: 'Moins de points et une respiration discrète.', speed: 0.7, params: { count: 80, layers: 2, size: 1.6, pulse: 0.05, frames: 36, fps: 12 } },
    { id: 'bright-pulse', label: 'Pulsation éclatante', description: 'Plus de couches et une pulsation plus visible.', speed: 1.2, params: { count: 180, layers: 4, size: 2.2, pulse: 0.15, frames: 32, fps: 24 } }
  ],
  heart_wave_ribbon: [
    { id: 'silky-ribbon', label: 'Ruban soyeux', description: 'Un ruban fin, peu chargé, qui se déplace tranquillement.', speed: 0.7, params: { samples: 120, amplitude: 7, waves: 8, width_ribbon: 7, size: 1.2, frames: 36 } },
    { id: 'vivid-ribbon', label: 'Ruban vibrant', description: 'Plus de détails et une ondulation plus ample.', speed: 1.2, params: { samples: 260, amplitude: 16, waves: 18, width_ribbon: 14, size: 1.9, frames: 24 } }
  ],
  huffman_love_tree: [
    { id: 'guided-tree', label: 'Explication pas à pas', description: 'Affiche les étapes et révèle les lignes lentement.', speed: 0.65, params: { show_steps: true, show_tree: true } },
    { id: 'quick-tree', label: 'Résumé rapide', description: 'Privilégie le résumé et une lecture plus rapide.', speed: 1.35, params: { show_steps: false, show_tree: true } }
  ],
  love_text_console: [
    { id: 'soft-console', label: 'Console en douceur', description: 'Un texte plus compact révélé lentement.', speed: 0.7, params: { width_chars: 32 } },
    { id: 'wide-console', label: 'Console panoramique', description: 'Une mise en page plus large avec une lecture vive.', speed: 1.25, params: { width_chars: 52 } }
  ],
  matrix_rain_violet: [
    { id: 'light-rain', label: 'Pluie légère', description: 'Moins de colonnes et une densité modérée.', speed: 0.7, params: { cols: 28, rows: 24, density: 0.16, tail: 6, steps: 60 } },
    { id: 'dense-rain', label: 'Averse lumineuse', description: 'Une pluie plus dense et plus longue.', speed: 1.2, params: { cols: 52, rows: 36, density: 0.38, tail: 12, steps: 130 } }
  ],
  maze_astar: [
    { id: 'easy-maze', label: 'Labyrinthe lisible', description: 'Un parcours compact à observer sans surcharge.', speed: 0.7, params: { size: 18, max_frames: 180 } },
    { id: 'complex-maze', label: 'Exploration détaillée', description: 'Un labyrinthe plus grand avec davantage d’étapes.', speed: 1.1, params: { size: 34, max_frames: 420 } }
  ],
  morphing_heart_contour: [
    { id: 'smooth-morph', label: 'Métamorphose douce', description: 'Une courbe légère avec peu de bruit.', speed: 0.65, params: { samples: 120, frames: 48, harmonics: 3, noise: 0.12, size: 1.4 } },
    { id: 'vivid-morph', label: 'Métamorphose vive', description: 'Plus de détails et une déformation plus marquée.', speed: 1.2, params: { samples: 280, frames: 30, harmonics: 6, noise: 0.55, size: 1.8 } }
  ],
  nqueens_backtracking: [
    { id: 'small-queens', label: 'Démonstration courte', description: 'Un petit échiquier et une recherche rapide.', speed: 0.7, params: { n: 6, max_frames: 180 } },
    { id: 'deep-queens', label: 'Recherche détaillée', description: 'Un échiquier plus grand pour suivre davantage d’essais.', speed: 1.1, params: { n: 10, max_frames: 420 } }
  ],
  orbit_heart_cluster: [
    { id: 'calm-orbit', label: 'Orbite tranquille', description: 'Quelques cœurs espacés qui tournent doucement.', speed: 0.65, params: { rings: 1, hearts: 4, points_per_heart: 14, heart_size: 14, speed: 1, frames: 48, size: 1.2 } },
    { id: 'bright-orbit', label: 'Orbite spectaculaire', description: 'Plus d’anneaux et de cœurs dans une rotation vive.', speed: 1.2, params: { rings: 3, hearts: 10, points_per_heart: 24, heart_size: 22, speed: 2, frames: 36, size: 1.8 } }
  ],
  sorting_visualizer: [
    { id: 'clear-sort', label: 'Tri pédagogique', description: 'Moins de valeurs et un rythme confortable pour suivre les échanges.', speed: 0.65, params: { count: 24, max_frames: 180 } },
    { id: 'quick-sort', label: 'Tri dynamique', description: 'Plus de valeurs et une lecture accélérée.', speed: 1.25, params: { count: 64, max_frames: 420 } }
  ]
}

function titleFromId(id: string) {
  return id.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

const analystTitles: Record<string, string> = {
  ab_test_significance: 'Test A/B',
  break_even_chart: 'Seuil de rentabilité',
  cohort_retention_heatmap: 'Rétention par cohorte',
  data_cleaning_report: 'Audit qualité des données',
  eoq_inventory: 'Quantité économique de commande',
  funnel_conversion: 'Entonnoir de conversion',
  kmeans_customers: 'Segmentation de clients',
  monte_carlo_budget: 'Simulation Monte-Carlo',
  moving_average_forecast: 'Prévision des ventes',
  pareto_chart: 'Diagramme de Pareto',
  regression_scatter: 'Régression linéaire',
  waterfall_profit: 'Résultat net en cascade'
}

const registryEntries = [...registry as RegistryEntry[], ...analystRegistry as RegistryEntry[]]
const analystAlgoIds = new Set((analystRegistry as RegistryEntry[]).map(entry => entry.id))
const parameterTypes: Record<RegistryParameter['type'], AlgoParameterType> = {
  int: 'integer',
  float: 'number',
  bool: 'boolean',
  select: 'select',
  str: 'text'
}

export const algos: AlgoDefinition[] = registryEntries.map((entry) => {
  const renderType = renderTypes[entry.render]
  const description = (entry.doc ?? entry.title ?? entry.id)
    .replace(/^[\w_]+ \(algo \d+\) : /, '')
    .replace(/^[\w_]+\s*:\s*/, '')
  const tags = [...new Set([renderType, ...entry.id.split('_').filter(part => part !== 'heart' && part !== 'love')])].slice(0, 4)

  return {
    id: entry.id,
    category: analystAlgoIds.has(entry.id) ? 'analyste' : 'anniversaire',
    title: analystTitles[entry.id] ?? titleFromId(entry.id),
    description,
    tags,
    file: `/algos/${entry.id}.py`,
    renderType,
    animationModes: animationModesByAlgo[entry.id] ?? [],
    parameters: entry.params.map(parameter => ({
      ...parameter,
      type: parameterTypes[parameter.type]
    }))
  }
})
