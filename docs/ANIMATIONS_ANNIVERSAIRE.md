# Animations pour le site anniversaire

Ce document rassemble les inspirations et concepts d'animation proposés pour le site de Rehael Doria. L'application est construite avec Nuxt/Vue; GSAP 3.15 est déjà installé. Framer Motion cible React et n'est donc pas retenu.

## Inspirations vidéo

### 1. Card Flip & Split — Codegrid

Une image ou une carte centrée s'ouvre pour dévoiler un message au verso. Avec ScrollTrigger et `scrub`, le conteneur s'élargit, un espace apparaît entre ses panneaux, puis les cartes pivotent sur l'axe Y pour révéler les vœux.

### 2. Parallax Strip Slider — Hyperiux

Un slider découpe chaque visuel en bandes verticales. Au changement de slide ou au défilement, les bandes glissent à des vitesses décalées pour créer une transition en parallaxe.

## Concepts anniversaire et GSAP

### 3. Memory Deck Tilt

Des photos, anecdotes et messages s'empilent comme des cartes en perspective 3D. Elles arrivent en cascade avec `rotationX`, `rotationY` et `perspective`. Au survol, la carte active se détache; les autres peuvent s'atténuer.

### 4. Celebration Reveal

Une carte cadeau s'ouvre en panneaux ou en bandes pour dévoiler les vœux, accompagnée d'une pluie de confettis et d'une apparition en cascade des messages.

### 5. Floating Orbit Cards

Des cartes de vœux et de souvenirs flottent doucement en boucle (`repeat: -1`, `yoyo: true`) avec de légères variations. Un clic peut ouvrir une vue détaillée.

## Concepts supplémentaires

### 6. Polaroid Scatter & Drop

Un petit mur de photos façon Polaroid apparaît avec des chutes décalées et des rotations légères. Au clic, la photo se redresse et s'agrandit; un message au verso peut être révélé.

### 7. Scrapbook Page Flip

Un carnet de souvenirs simule un livre feuilleté. ScrollTrigger fait pivoter les pages autour de leur bord gauche pour dévoiler les souvenirs suivants.

### 8. Spotlight & Focus

Un halo doux suit le pointeur sur ordinateur et met en évidence l'élément actif. Sur tactile, la lumière reste centrée sur la carte sélectionnée plutôt que de dépendre du survol.

## Choix pour ce projet

| Concept | Adéquation | Adaptation responsive | Décision |
| --- | --- | --- | --- |
| Memory Deck Tilt | Excellente pour les trois portraits locaux de la page anniversaire | Le deck devient une pile compacte au toucher; les photos gardent leur ratio natif | Appliqué au héros anniversaire |
| Polaroid Scatter & Drop | Très bonne avec un nombre limité de photos personnelles | Entrée simplifiée et sans déplacement excessif sur petit écran | Appliqué comme arrivée en cascade avec rebond léger |
| Spotlight & Focus | Bonne en accent discret, pas comme effet permanent | Pointeur uniquement sur desktop; la carte sélectionnée est mise en avant au toucher | Appliqué sous forme de lumière douce au pointeur et sur la carte active |
| Card Flip & Split | Bonne pour un message au verso; une version flip existe déjà dans la page Voyage | Utilisable au clic, sans dépendance au scroll | Réutilisable, mais éviter de dupliquer l'effet partout |
| Floating Orbit Cards | Adaptée à une transition ou un petit groupe de cartes | Le mouvement doit être réduit ou arrêté selon `prefers-reduced-motion` | Optionnelle |
| Parallax Strip Slider | Effet fort mais risque de nuire à la lecture et aux gestes de balayage | Coût d'interaction élevé sur mobile | Non prioritaire |
| Celebration Reveal | Très adaptée à la page Surprise, moins à l'anniversaire principal | Déclenchement volontaire, animation courte | À réserver à la Surprise |
| Scrapbook Page Flip | Intéressante si une vraie chronologie de photos par année existe | Scroll/3D plus délicat et risque de gêner le mobile | En attente de photos datées supplémentaires |

## Règles d'implémentation

- Préserver les ratios natifs des portraits et ne pas étirer les fichiers.
- Limiter les animations à l'entrée et aux actions intentionnelles; les vidéos ne démarrent pas automatiquement.
- Garder des contrôles tactiles assez grands et un flux lisible sans hover.
- Respecter `prefers-reduced-motion` : supprimer parallaxe, défilement épinglé et animations décoratives.
- Réutiliser GSAP déjà présent; ne pas installer Framer Motion dans cette application Vue.