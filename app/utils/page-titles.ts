// ============================================================
// Titres de page du site.
//
// Chaque page affichait le même <title> (« Club Otaku ENEAM »), ce qui est
// mauvais pour le référencement, les onglets du navigateur et le partage de
// liens. Une seule table ici, appliquée globalement dans app.vue à partir de
// la route courante : une nouvelle page n'a qu'une ligne à ajouter.
// ============================================================

const SITE_NAME = 'Club Otaku ENEAM'

export const pageTitles: Record<string, string> = {
  '/': 'Accueil',
  '/auth': 'Connexion',
  '/inscription': 'Créer un compte',
  '/communaute': 'Communauté',
  '/evenements': 'Événements',
  '/tournois': 'Tournois',
  '/equipes': 'Équipes',
  '/galerie': 'Galerie',
  '/boutique': 'Boutique',
  '/espace-membre': 'Mon espace',
  '/dashboard': 'Administration',
  '/dashboard-evenementiel': 'Événementiel',
  '/dashboard-communication': 'Communication',
  '/dashboard-gaming': 'Gaming',
  '/dashboard-moderation': 'Modération',
  '/dashboard-super-admin': 'Super-administration',
  '/boutique-dashboard': 'Commandes boutique',
  '/boutique-catalogue': 'Catalogue boutique',
  '/boutique-produits': 'Ajouter un produit'
}

// Pages dynamiques : on ne connaît pas l'identifiant, mais on connaît la
// section — le titre reste donc utile plutôt que générique.
const SECTIONS: Array<[RegExp, string]> = [
  [/^\/tournois\/[^/]+/, 'Détail du tournoi'],
  [/^\/gaming-tournoi-/, 'Organisation du tournoi'],
  [/^\/equipes\/[^/]+/, 'Détail de l’équipe']
]

export function titleForPath(path: string): string {
  const clean = (path.split('?')[0] || '/').replace(/\/+$/, '') || '/'
  const exact = pageTitles[clean]
  if (exact) return `${exact} | ${SITE_NAME}`
  for (const [pattern, label] of SECTIONS) {
    if (pattern.test(clean)) return `${label} | ${SITE_NAME}`
  }
  return SITE_NAME
}
