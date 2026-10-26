/** Glossaire de l'analyste d'entreprise : définitions courtes, avec un exemple chiffré ou concret. */
export type GlossaryCategory = 'finance' | 'donnees' | 'client' | 'projet' | 'stats'

export const CATEGORY_LABEL: Record<GlossaryCategory, string> = {
  finance: 'Finance et gestion',
  donnees: 'Données',
  client: 'Marketing et clients',
  projet: 'Projet et méthode',
  stats: 'Statistiques',
}

export interface Term {
  term: string
  category: GlossaryCategory
  definition: string
  example: string
}

export const TERMS: Term[] = [
  { term: 'Chiffre d’affaires', category: 'finance', definition: 'Total des ventes réalisées sur une période, avant de retirer les coûts.', example: '200 clients qui achètent chacun pour 50 € font 10 000 € de chiffre d’affaires.' },
  { term: 'Marge brute', category: 'finance', definition: 'Chiffre d’affaires moins le coût direct de ce qui est vendu. Le taux de marge brute se calcule en pourcentage du chiffre d’affaires.', example: 'Un gâteau vendu 10 € qui coûte 4 € à produire laisse 6 € de marge brute, soit 60 %.' },
  { term: 'Marge nette', category: 'finance', definition: 'Ce qui reste du chiffre d’affaires après toutes les charges et les impôts.', example: '22 500 € de résultat net sur 200 000 € de chiffre d’affaires : 11,25 % de marge nette.' },
  { term: 'Coûts fixes', category: 'finance', definition: 'Coûts qui ne dépendent pas du volume vendu : loyer, salaires, abonnements.', example: 'Le loyer d’une boutique reste le même, que l’on vende 10 ou 1 000 articles.' },
  { term: 'Coûts variables', category: 'finance', definition: 'Coûts qui augmentent avec chaque unité produite ou vendue : matières premières, emballage.', example: 'Chaque cupcake coûte 0,80 € d’ingrédients, donc 80 € pour 100 cupcakes.' },
  { term: 'Seuil de rentabilité', category: 'finance', definition: 'Quantité à vendre pour que le résultat soit égal à zéro : coûts fixes ÷ (prix − coût variable unitaire).', example: '12 000 € de coûts fixes, 40 € de prix, 22 € de coût variable : 12 000 ÷ 18 = 667 unités.' },
  { term: 'Trésorerie', category: 'finance', definition: 'Argent réellement disponible sur les comptes à un moment donné. Une entreprise rentable peut manquer de trésorerie si ses clients paient tard.', example: 'Une facture de 5 000 € payable à 60 jours ne rentre pas en caisse tout de suite.' },
  { term: 'Besoin en fonds de roulement (BFR)', category: 'finance', definition: 'Argent à avancer pour faire fonctionner l’activité entre le moment où l’on paie (stocks, fournisseurs) et celui où l’on est payé.', example: 'On paie ses ingrédients au comptant mais les clients professionnels règlent à 30 jours : le BFR augmente.' },
  { term: 'ROI (retour sur investissement)', category: 'finance', definition: 'Gain obtenu rapporté à la somme investie : (gain − coût) ÷ coût.', example: '2 000 € de publicité qui rapportent 5 000 € de marge : (5 000 − 2 000) ÷ 2 000 = 150 %.' },
  { term: 'EBITDA (excédent brut d’exploitation)', category: 'finance', definition: 'Résultat de l’activité avant intérêts, impôts, dépréciations et amortissements. Il mesure ce que l’exploitation génère avant les choix de financement et d’investissement.', example: 'Deux entreprises aux mêmes ventes mais aux dettes différentes ont le même EBITDA.' },
  { term: 'Budget prévisionnel', category: 'finance', definition: 'Estimation chiffrée des recettes et des dépenses à venir, que l’on compare ensuite au réel.', example: 'Prévu 40 000 € de dépenses marketing ; réalisé 46 000 € : écart de +15 %.' },

  { term: 'KPI (indicateur clé de performance)', category: 'donnees', definition: 'Chiffre choisi pour suivre l’atteinte d’un objectif précis. Un bon KPI est mesurable, compris de tous et relié à une décision.', example: 'Objectif « fidéliser » : KPI = taux de rachat à 90 jours.' },
  { term: 'Tableau de bord', category: 'donnees', definition: 'Page qui rassemble quelques KPI et graphiques pour suivre l’activité d’un coup d’œil.', example: 'Ventes du mois, taux de conversion, réclamations en cours, sur un seul écran.' },
  { term: 'Base de données', category: 'donnees', definition: 'Ensemble organisé de données, souvent en tables reliées entre elles (clients, commandes, produits).', example: 'La table « commandes » contient une ligne par achat et l’identifiant du client.' },
  { term: 'SQL', category: 'donnees', definition: 'Langage pour interroger une base de données : sélectionner, filtrer, regrouper, trier, relier des tables.', example: 'SELECT produit, SUM(montant) FROM commandes GROUP BY produit.' },
  { term: 'Jointure', category: 'donnees', definition: 'Opération qui relie deux tables grâce à une colonne commune.', example: 'Relier clients.id et commandes.client_id pour afficher le nom du client à côté de chaque commande.' },
  { term: 'Nettoyage de données', category: 'donnees', definition: 'Étape qui consiste à corriger ou retirer les erreurs d’un jeu de données : doublons, valeurs manquantes, formats incohérents, valeurs aberrantes.', example: 'Deux lignes identiques pour la même commande faussent le total des ventes.' },
  { term: 'Valeur aberrante', category: 'donnees', definition: 'Valeur très éloignée des autres, qui peut être une erreur ou un cas réel exceptionnel. À vérifier avant de la supprimer.', example: 'Un panier de 4 500 € parmi des paniers de 20 à 80 €.' },
  { term: 'ETL', category: 'donnees', definition: 'Extraire, transformer, charger : chaîne qui récupère des données de sources diverses, les nettoie et les range dans un entrepôt.', example: 'Chaque nuit, les ventes du site et de la caisse sont réunies dans une même base.' },
  { term: 'Entrepôt de données (data warehouse)', category: 'donnees', definition: 'Base centrale qui regroupe les données de toute l’entreprise pour l’analyse.', example: 'Ventes, stocks et service client consultables ensemble pour un même client.' },
  { term: 'Visualisation de données', category: 'donnees', definition: 'Représentation graphique des données pour faire comprendre un message : le bon type de graphique dépend de la question.', example: 'Une courbe pour une évolution dans le temps, des barres pour comparer des catégories.' },

  { term: 'Taux de conversion', category: 'client', definition: 'Part des visiteurs qui accomplissent l’action voulue (acheter, s’inscrire…).', example: '4 700 commandes pour 64 000 visiteurs : 7,3 %.' },
  { term: 'Entonnoir de conversion', category: 'client', definition: 'Suite d’étapes que franchit un visiteur jusqu’à l’achat, avec une perte à chaque étape.', example: 'Visite, fiche produit, panier, paiement, commande.' },
  { term: 'Coût d’acquisition client (CAC)', category: 'client', definition: 'Dépenses commerciales et marketing divisées par le nombre de nouveaux clients gagnés.', example: '3 000 € dépensés pour 100 nouveaux clients : CAC de 30 €.' },
  { term: 'Valeur vie client (CLV)', category: 'client', definition: 'Marge qu’un client rapporte en moyenne pendant toute sa relation avec l’entreprise.', example: 'Un abonné qui reste 18 mois et laisse 8 € de marge par mois vaut 144 €.' },
  { term: 'Churn (taux d’attrition)', category: 'client', definition: 'Part des clients ou abonnés perdus sur une période.', example: '50 abonnés partis sur 1 000 en un mois : churn de 5 %.' },
  { term: 'Taux de rétention', category: 'client', definition: 'Part des clients qui restent actifs après une période. C’est le complément du churn.', example: 'Churn de 5 % : rétention de 95 %.' },
  { term: 'Panier moyen', category: 'client', definition: 'Chiffre d’affaires divisé par le nombre de commandes.', example: '100 000 € pour 2 500 commandes : 40 € de panier moyen.' },
  { term: 'Segmentation', category: 'client', definition: 'Découpage des clients en groupes aux comportements ou besoins proches, pour adapter l’offre.', example: 'Occasionnels, fidèles, gros acheteurs.' },
  { term: 'Persona', category: 'client', definition: 'Portrait fictif mais réaliste d’un client type, construit à partir de données et d’entretiens.', example: 'Inès, 22 ans, étudiante, commande surtout sur mobile le week-end.' },
  { term: 'NPS (Net Promoter Score)', category: 'client', definition: 'Indicateur de recommandation : % de promoteurs (notes 9 et 10) moins % de détracteurs (notes de 0 à 6).', example: '60 % de promoteurs et 15 % de détracteurs : NPS de +45.' },

  { term: 'Cahier des charges', category: 'projet', definition: 'Document qui décrit le besoin, les contraintes, les fonctionnalités attendues et les critères de réussite d’un projet.', example: 'Le site doit afficher les frais de livraison dès le panier.' },
  { term: 'Partie prenante', category: 'projet', definition: 'Personne ou groupe qui influence le projet ou qui est touché par lui : clients, direction, équipe, fournisseurs.', example: 'Le service client est une partie prenante d’un nouvel outil de réclamations.' },
  { term: 'User story', category: 'projet', definition: 'Besoin exprimé du point de vue de l’utilisateur : « En tant que… je veux… afin de… ».', example: 'En tant que cliente, je veux voir les frais de livraison afin de ne pas être surprise.' },
  { term: 'MoSCoW', category: 'projet', definition: 'Méthode de priorisation : Must (indispensable), Should (important), Could (souhaitable), Won’t (pas cette fois).', example: 'Le paiement est un Must ; le mode sombre est un Could.' },
  { term: 'Backlog', category: 'projet', definition: 'Liste ordonnée des fonctionnalités et tâches à réaliser sur un produit.', example: 'Les tâches les plus utiles sont en haut de la liste.' },
  { term: 'Sprint', category: 'projet', definition: 'Période courte et fixe (souvent 1 à 4 semaines) pendant laquelle l’équipe réalise un lot de tâches choisi à l’avance.', example: 'Sprint de deux semaines avec 20 jours de capacité.' },
  { term: 'Périmètre (scope)', category: 'projet', definition: 'Ensemble de ce qui est inclus dans le projet, et donc de ce qui n’y est pas.', example: 'L’application mobile est hors périmètre de la première version.' },
  { term: 'BPMN', category: 'projet', definition: 'Notation standard pour dessiner un processus (étapes, décisions, acteurs) afin de le comprendre et de l’améliorer.', example: 'Du passage de commande à la livraison, avec les décisions « stock disponible ? ».' },
  { term: 'Analyse SWOT', category: 'projet', definition: 'Tableau à quatre cases : forces et faiblesses (internes), opportunités et menaces (externes).', example: 'Un four unique est une faiblesse ; la hausse du prix du beurre est une menace.' },
  { term: 'Diagramme de Pareto', category: 'projet', definition: 'Barres triées de la plus grande à la plus petite, avec le cumul en %. Il montre que peu de causes expliquent l’essentiel d’un problème (souvent 20 % des causes pour 80 % des effets).', example: 'Trois causes sur six font 87 % des réclamations.' },
  { term: 'Méthode des 5 pourquoi', category: 'projet', definition: 'Demander « pourquoi ? » de proche en proche pour remonter d’un symptôme à une cause racine sur laquelle on peut agir.', example: 'Colis abîmés, carton trop grand, un seul format, aucune règle de choix.' },
  { term: 'Matrice des risques', category: 'projet', definition: 'Grille qui place chaque risque selon sa probabilité et son impact pour décider quoi traiter d’abord.', example: 'Un risque très probable et très grave passe en premier.' },
  { term: 'Livrable', category: 'projet', definition: 'Résultat concret remis à la fin d’une tâche ou d’un projet.', example: 'Un rapport d’analyse avec ses recommandations.' },
  { term: 'Jalon (milestone)', category: 'projet', definition: 'Étape clé du calendrier qui marque l’avancement du projet.', example: 'Validation du cahier des charges le 15 mars.' },

  { term: 'Moyenne et médiane', category: 'stats', definition: 'La moyenne additionne puis divise ; la médiane est la valeur du milieu quand on classe les données. La médiane résiste mieux aux valeurs extrêmes.', example: 'Salaires 20, 21, 22, 23, 200 : moyenne 57,2 ; médiane 22.' },
  { term: 'Écart type', category: 'stats', definition: 'Mesure de la dispersion des valeurs autour de la moyenne : plus il est grand, plus les valeurs sont étalées.', example: 'Deux boutiques à 100 ventes par jour en moyenne ; la plus régulière a le plus petit écart type.' },
  { term: 'Corrélation', category: 'stats', definition: 'Tendance de deux séries à varier ensemble, mesurée par un coefficient r entre −1 et +1. Elle ne prouve pas une cause.', example: 'Ventes de glaces et ventes de lunettes de soleil évoluent ensemble.' },
  { term: 'Causalité', category: 'stats', definition: 'Relation où un facteur provoque réellement un changement dans un autre. On la prouve avec une expérience contrôlée, pas avec une simple corrélation.', example: 'Un test A/B montre qu’un bouton plus visible augmente les commandes.' },
  { term: 'Régression linéaire', category: 'stats', definition: 'Droite qui résume au mieux la relation entre deux variables, par la méthode des moindres carrés ; elle sert à décrire et à prévoir.', example: 'Chaque 1 000 € de publicité en plus correspond en moyenne à 2 300 € de ventes.' },
  { term: 'Test A/B', category: 'stats', definition: 'Comparaison de deux versions montrées au hasard à deux groupes de visiteurs pour mesurer l’effet d’un changement.', example: 'Version A : bouton gris ; version B : bouton vert ; on compare les conversions.' },
  { term: 'p-valeur', category: 'stats', definition: 'Probabilité d’observer un écart au moins aussi grand que celui mesuré si, en réalité, il n’y avait aucune différence. Une petite p-valeur (souvent sous 5 %) rend le hasard peu plausible.', example: 'p = 0,02 : seulement 2 chances sur 100 d’un tel écart si les versions étaient identiques.' },
  { term: 'Échantillon', category: 'stats', definition: 'Sous-ensemble choisi pour étudier une population entière. Il doit être assez grand et représentatif.', example: 'Interroger 400 clients tirés au hasard sur 20 000.' },
  { term: 'Intervalle de confiance', category: 'stats', definition: 'Fourchette de valeurs plausibles pour une quantité inconnue, avec un niveau de confiance (souvent 95 %).', example: 'Un taux de conversion de 3,0 % ± 0,4 point.' },
  { term: 'Saisonnalité', category: 'stats', definition: 'Variation régulière qui se répète à chaque période (mois, semaine, année).', example: 'Les ventes de chocolat montent chaque année en décembre.' },
]
