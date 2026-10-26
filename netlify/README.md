# Stockage partagé des chansons

L’API `/api/shared-songs` utilise PostgreSQL sur Neon. La variable `DATABASE_URL`
et la table `shared_songs` sont nécessaires pour partager les ajouts entre les
visiteurs.

## Configuration de Neon

1. Dans Neon, ouvre le projet et la branche qui serviront le site, puis récupère
   la chaîne de connexion PostgreSQL **pooled** (avec `-pooler` dans l’hôte).
2. Dans Netlify, ouvre **Site configuration → Environment variables** et ajoute
   `DATABASE_URL` avec cette chaîne. Applique-la au contexte de déploiement voulu
   (au minimum Production ; ajoute Deploy Previews si elles doivent aussi accéder
   au stockage). Ne place pas cette valeur dans le dépôt.
3. Dans le SQL Editor Neon, sélectionne la même branche et la même base, puis
   exécute [`migrations/001_shared_songs.sql`](./migrations/001_shared_songs.sql).
4. Redéploie le site pour que la fonction Netlify prenne en compte la variable.
   Vérifie ensuite `https://<ton-site>/api/shared-songs` : la réponse doit être
   un JSON contenant `tracks`.

Si l’API indique que `DATABASE_URL` manque, vérifie le contexte Netlify auquel la
variable est affectée. Si elle indique que la table manque, vérifie que la
migration a été exécutée sur la branche Neon visée par cette URL.
