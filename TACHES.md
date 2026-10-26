# Liste des tâches

Les étapes sont réalisées dans l'ordre. Après chaque étape, attendre la validation avant de poursuivre.

## 0. Audit
- [x] Inspecter le projet de base et présenter les composants réutilisables.
- [x] Conserver les anciens composants dans `app/components-legacy/`.

## 1. Base, nettoyage et thème
- [x] Vérifier que la base est déjà en Nuxt 4.
- [x] Adapter la palette au violet, à la lavande et au rose poudré.
- [x] Simplifier le shell racine et retirer la configuration/runtime Prisma, Supabase et Cloudinary.
- [x] Déplacer les anciennes pages et API hors des chemins actifs de Nuxt, sans perdre les sources archivées.
- [x] Désactiver l'ancien démarrage automatique des pistes audio.
- [x] Retirer les dépendances backend inutilisées (Prisma, PostgreSQL, Supabase, Cloudinary et dotenv) et synchroniser le lockfile.
- [x] Installer et valider `@nuxt/image`, `@nuxt/fonts`, `pinia` et `@pinia/nuxt`.
- [ ] Décider quelles dépendances d'animation optionnelles ajouter ou remplacer par des solutions natives.
- [x] Réparer les dépendances locales et valider `nuxt prepare`, `nuxt typecheck` et `nuxt build`.

## 2. Données et structure
- [x] Créer les registres de médias, souvenirs, lettre, configuration et algorithmes/jeux.
- [x] Écrire le script qui génère `app/data/media.ts` depuis les dossiers photo et vidéo.
- [x] Préparer les pages et la navigation du site statique.

## 3. Entrée et ambiance
- [x] Créer l'EntryGate mémorable et mobile-first.
- [x] Débloquer la musique au clic sur le contrôle audio global.
- [x] Adapter le gestionnaire audio à une chanson en boucle et relier le contrôle audio global.
- [x] Créer les composants d'ambiance et effets réutilisables.

## 4. Anniversaire
- [x] Construire les sections de la page anniversaire une par une.
- [x] Créer la page interactive des lettres de « Rehael Doria » avec un compliment par lettre et afficher ses 18 ans.
- [x] Mettre en scène les portraits en Memory Deck responsive avec arrivée Polaroid et spotlight.
- [x] Créer le parcours immersif photos/vidéos « Le fil des instants ».
- [ ] Respecter les médias locaux, mobile-first et prefers-reduced-motion.

## 5. Galerie
- [x] Créer la grille masonry, les filtres et la lightbox photo/vidéo.

## 6. Algorithmes
- [x] Créer le registre et documenter la convention Python dans `docs/ALGOS.md`.
- [x] Créer la liste et la page de détail des algorithmes pour le front.
- [x] Créer le runner Pyodide dans un Web Worker avec annulation et cache.
- [x] Créer un renderer canvas de base pour les points et le preview en direct.
- [x] Finaliser le playground complet et la gestion de plusieurs types de rendu.
- [x] Ajouter le support de rendu `frames` dans le playground.

## 7. Jeux
- [x] Créer le registre, GameShell et les composants communs.
- [x] Implémenter MemoryGame et TerminalPuzzle.
- [x] Étendre la collection avec LoveQuiz et HeartTap.
- [x] Ajouter les défis Phishing Detective, Password Lab et Cipher Breaker.

## 8. Finalisation
- [x] Créer la page surprise et la page 404 thématique.
- [x] Documenter les huit concepts d'animation anniversaire dans `docs/ANIMATIONS_ANNIVERSAIRE.md`.
- [x] Ajouter noindex aux pages concernées.
- [x] Harmoniser l’application du thème et animer le changement clair/sombre.
- [ ] Terminer le polish responsive et valider les parcours mobile/iOS.
- [x] Valider la génération statique avec `nuxt generate`.
