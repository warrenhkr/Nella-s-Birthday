# Prompt du projet

Colle le prompt du nouveau projet ci-dessous.

---

CONTEXTE
Je construis un site web d'anniversaire pour une amie, Rehael Doria. C'est une expérience émotionnelle, très moderne et très "girly", pensée d'abord pour mobile. Elle fait de l'informatique : le site contient donc une page d'algos et un mini-jeu qui lui parlent. Date d'anniversaire : [DATE_ANNIVERSAIRE]. Âge : [ÂGE].
Je pars d'un projet Nuxt existant copié comme base. Conserve ma structure et mes conventions.

ÉTAPE 0 — AUDIT (OBLIGATOIRE AVANT TOUT CODE)
Je mets à ta disposition des composants issus de mes anciens projets. Avant de créer quoi que ce soit :
1. Inspecte le projet de base et les composants fournis, et liste ce qui est réutilisable (animations, cartes, lightbox, carrousels, boutons, layouts, utilitaires).
2. Réutilise ou adapte l'existant plutôt que de réécrire. Ne crée un composant que s'il n'existe pas déjà un équivalent proche.
3. Présente-moi un tableau : composant demandé / réutilisé depuis l'existant / adapté / créé de zéro. Attends ma validation avant de continuer.

STACK
- Nuxt 4 (dossier app/), TypeScript. Si la base est en Nuxt 3, migre-la en Nuxt 4 d'abord.
- Nuxt UI + Tailwind CSS 4, thème violet personnalisé (lavande, mauve, violet profond, rose poudré en accent)
- @nuxt/icon (Lucide / Phosphor), @nuxt/image, @nuxt/fonts, @vueuse/nuxt, Pinia
- Animations : GSAP + ScrollTrigger, motion-v, Lenis, canvas-confetti, tsParticles, Embla ou Swiper
- Polices : une serif élégante (titres), une script (accents), une sans-serif arrondie (texte)
- PAS de base de données, PAS de Cloudinary, PAS de backend. Site statique (nuxt generate).
- N'ajoute aucune dépendance sans me la signaler d'abord.

MÉDIAS
- Les photos sont dans public/media/photos et les vidéos dans public/media/videos. Les fichiers ont des noms variés.
- Écris un script qui scanne ces dossiers et génère automatiquement le registre app/data/media.ts (chemin, type, dimensions si possible, légende vide à compléter).
- Constante FAVORITE_VIDEO dans app/data/config.ts : nom du fichier de la vidéo préférée de Rehael Doria ([NOM_FICHIER]). Elle tourne en boucle dans FavoriteVideoLoop.
- Photos via @nuxt/image (WebP, lazy-loading, responsive). Vidéos : muted, loop, playsinline, preload léger. Une seule vidéo avec son à la fois.

PAGES
- / : EntryGate. Le clic débloque le son puis redirige vers /anniversaire.
- /anniversaire : scroll unique (HeroBirthday, PhotoMarquee, PolaroidStack, VideoShowcase, FavoriteVideoLoop, TimelineMemories, QualitiesCards, WishesLetter, CakeCandles).
- /galerie : GalleryGrid (masonry) et MediaLightbox.
- /algos : liste des algos Python (cartes) avec une page de détail /algos/[id].
- /jeu : mini-jeux (voir section JEU).
- /surprise : message final avec un dernier effet fort.
- 404 dans le thème.
- Navigation : menu flottant discret (icônes) entre les pages, caché sur l'écran d'entrée.

COMPOSANTS — STRUCTURE ET AMBIANCE
- EntryGate : plein écran, cœur animé qui bat, texte "Rehael Doria, ouvre ton cadeau", bouton. Au clic : débloque l'audio, lance ConfettiBurst, transition vers /anniversaire. Ne s'affiche qu'une fois par session (état Pinia).
- AppBackground : dégradé violet animé lent + couche de particules (tsParticles) légère. Props : intensity (low/medium), pour réduire sur mobile.
- MusicToggle : bouton flottant son on/off, lit l'état Pinia, icône animée.
- ScrollProgress : barre de progression en haut, faite de petits cœurs qui se remplissent.
- PageTransition : transition douce (fondu + léger zoom) entre les pages.
- FloatingNav : navigation flottante avec icônes et label au survol / appui long.

COMPOSANTS — SECTIONS DE /anniversaire
- HeroBirthday : prénom en grand avec effet de révélation lettre par lettre, âge animé (compteur), sous-titre, indicateur "scroll".
- PhotoMarquee : deux rangées de photos défilant en sens opposé, pause au survol/appui.
- PolaroidStack : pile de polaroïds avec légendes ; au scroll ils se déploient en éventail, légères rotations aléatoires.
- VideoShowcase : grille ou carrousel de vidéos ; lecture automatique (muette) quand visible à l'écran, pause quand hors écran ; appui pour activer le son.
- FavoriteVideoLoop : la vidéo préférée, grande, en boucle, avec cadre décoratif violet, bouton son, effet de glow qui réagit à la lecture.
- TimelineMemories : frise verticale de souvenirs (date, titre, texte, photo) alimentée par app/data/memories.ts ; apparition au scroll.
- QualitiesCards : cartes "pourquoi tu es géniale" (icône, titre, texte), effet de retournement ou d'inclinaison 3D léger.
- WishesLetter : lettre principale avec papier stylisé, texte qui s'écrit progressivement au scroll ; contenu dans app/data/letter.ts.
- CakeCandles : gâteau illustré avec bougies ; on souffle via clic (et via micro si la permission est accordée, avec fallback clic) ; extinction → ConfettiBurst + message.

COMPOSANTS — GALERIE
- GalleryGrid : masonry responsive, filtres photos / vidéos, chargement progressif.
- MediaLightbox : ouverture plein écran, swipe mobile, flèches clavier, fermeture au geste/échap, lecture vidéo intégrée.

COMPOSANTS — ALGOS PYTHON
Je code beaucoup d'algos Python moi-même (cœur, spirales, automates cellulaires, fractales, etc.). N'écris PAS les algos. Construis un système où j'ajoute un algo en déposant un fichier, sans modifier le front.
- Registre app/data/algos.ts : pour chaque algo → id, titre, description, tags, fichier Python (dans public/algos/), type de rendu (points | frames | grille | texte | image), paramètres exposés (nom, type, min, max, défaut), et éventuellement un fichier JSON pré-généré (public/data/) pour un algo exécuté hors ligne.
- Convention Python : chaque fichier expose une fonction run(params) qui renvoie un dictionnaire dont la structure dépend du type de rendu. Documente cette convention dans un fichier docs/ALGOS.md avec un exemple minimal pour chaque type de rendu.
- PyodideRunner : charge Pyodide en lazy-load, uniquement sur /algos, dans un Web Worker. Gère le chargement des paquets (numpy au minimum), un état de chargement soigné ("préparation de la magie..."), les erreurs lisibles, un bouton stop/annuler, et un cache pour ne pas recharger Pyodide à chaque algo.
- AlgoCard : carte dans la liste (titre, description, tags, aperçu), animation au survol.
- AlgoPlayground : page de détail : panneau de paramètres généré automatiquement depuis le registre (sliders, champs, sélecteurs), bouton "Lancer", zone de rendu, option "voir le code Python" (affichage du fichier avec coloration syntaxique légère).
- Renderers (un composant par type de rendu) : PointsRenderer (tracé progressif de points/courbes, pulsation), FramesRenderer (animation image par image), GridRenderer (automates, cellules), TextRenderer (sortie console stylée). Tous en canvas, redimensionnables, avec thème violet.
- CanvasHeart : cas particulier du PointsRenderer pour un cœur qui se dessine puis pulse ; réutilisable ailleurs (EntryGate, /surprise).

JEU (/jeu)
Rehael Doria fait de l'informatique : les jeux doivent lui parler. Structure extensible : registre app/data/games.ts et un composant GameShell commun (titre, score, bouton rejouer, retour au menu). Implémente d'abord deux jeux, je pourrai en ajouter :
1. MemoryGame : paires de cartes avec les photos de Rehael Doria (tirées du registre média), niveaux de difficulté, compteur de coups et de temps, animation de retournement, effet de victoire.
2. TerminalPuzzle : faux terminal violet avec commandes à deviner (ls, cat, cd...) pour trouver un message secret de ma part ; indices progressifs, humour de dev, et récompense à la fin (message + ConfettiBurst).
- Composants communs : GameShell, GameMenu (cartes de jeux), Scoreboard (meilleurs scores en localStorage, protégé côté client), VictoryModal.

COMPOSANTS — EFFETS RÉUTILISABLES
- ConfettiBurst : fonction/composant avec variantes (cœurs, étoiles, rond) ; intensité réduite si prefers-reduced-motion.
- FloatingHearts : cœurs montant lentement, nombre configurable.
- SparkleCursor : traînée d'étincelles sous le doigt/curseur, désactivée sur mobile si coûteuse.
- RevealOnScroll : wrapper générique (fade, slide, scale) basé sur IntersectionObserver ou ScrollTrigger.

CONTRAINTES TECHNIQUES
- GSAP, canvas, Pyodide, vidéo et Lenis uniquement côté client (ClientOnly ou onMounted) pour éviter les erreurs d'hydratation.
- Mobile d'abord. Tester le comportement iOS Safari (autoplay, plein écran, barre d'adresse dynamique).
- Respecter prefers-reduced-motion.
- Limiter les animations simultanées ; viser une expérience fluide sur un téléphone d'entrée de gamme.
- noindex sur tout le site.
- Code typé, composants courts, props documentées, commentaires uniquement quand ils apportent quelque chose.

MÉTHODE
Avance par étapes et attends ma validation entre chacune :
0. Audit et tableau de réutilisation (voir plus haut).
1. Mise à niveau/nettoyage de la base, modules, thème violet (tokens, polices).
2. Données (media, config, memories, letter), script de scan des médias, pages vides, navigation.
3. EntryGate, gestion du son, composants d'ambiance.
4. Sections de /anniversaire, une par une.
5. /galerie et lightbox.
6. Système d'algos : registre, PyodideRunner, renderers, AlgoPlayground, docs/ALGOS.md, avec un algo exemple factice.
7. /jeu : GameShell, MemoryGame, TerminalPuzzle.
8. /surprise, 404, optimisation, tests mobile, nuxt generate.