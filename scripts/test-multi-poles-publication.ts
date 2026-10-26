// scripts/test-multi-poles-publication.ts
//
// Preuve EXÉCUTABLE, SANS AUCUNE ÉCRITURE EN BASE, de deux choses :
//
//   A. MULTI-PÔLES — un membre peut appartenir à plusieurs pôles : union
//      « poles + pole » (compatibilité ascendante), nettoyage des doublons,
//      refus des pôles inconnus, pôle principal = premier pôle choisi.
//
//   B. PUBLICATION DANS LES 6 PÔLES — pour chacun des 6 pôles officiels :
//      l'API d'annonces accepte le pôle (schéma zod RÉEL de production),
//      l'annonce est ensuite VISIBLE sous le filtre de ce pôle, et masquée
//      sous les autres. Idem pour les événements à pôle.
//
// Ce script importe le VRAI code de production (Node 24 lit le TypeScript
// nativement) :
//   • shared/poles.ts                → toute la logique de pôles
//   • server/schemas/index.ts        → validation zod réellement appliquée
//                                      par POST /api/communaute/posts
// Le handler HTTP lui-même n'est pas bundlé (il toucherait la base) : son
// câblage est vérifié par assertions sur son source réel, ci-dessous.
//
// Usage : node scripts/test-multi-poles-publication.ts

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import {
  ALL_POLES,
  POLE_LABELS,
  POLE_SLUGS,
  resolveUserPoles,
  primaryPoleOf,
  sanitizePoles,
  toPoleSlug,
  rawPoleMatches,
  poleLabelsOf,
  polesToText
} from '../shared/poles.ts'

import {
  CommunityPostCreateSchema,
  EventCreateSchema
} from '../server/schemas/index.ts'

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..')

let echecs = 0
let total = 0

function verifier(nom: string, condition: boolean, detail = '') {
  total += 1
  if (condition) {
    console.log(`  OK   ${nom}${detail ? ` — ${detail}` : ''}`)
  } else {
    echecs += 1
    console.log(`  ÉCHEC ${nom}${detail ? ` — ${detail}` : ''}`)
  }
}

function lire(chemin: string) {
  return readFileSync(resolve(racine, chemin), 'utf8')
}

console.log('\n=== A. MULTI-PÔLES (union « poles + pole ») ===')

// A1. Les 6 pôles officiels, dans l'ordre partagé.
verifier(
  'A1 · 6 pôles officiels',
  POLE_SLUGS.length === 6 && POLE_SLUGS.join(',') === 'anime,manga,gaming,danse,k-drama,culture',
  POLE_SLUGS.join(' · ')
)

// A2. Compatibilité ascendante : un compte mono-pôle continue de fonctionner.
const ancienCompte = { pole: 'gaming', poles: [] as string[] }
verifier(
  'A2 · ancien compte (pole seul) → 1 pôle',
  JSON.stringify(resolveUserPoles(ancienCompte)) === '["gaming"]',
  `pole=${ancienCompte.pole} → ${JSON.stringify(resolveUserPoles(ancienCompte))}`
)

const ancienSansPoles = { pole: 'k-drama' }
verifier(
  'A2b · ancien compte sans tableau poles',
  JSON.stringify(resolveUserPoles(ancienSansPoles)) === '["k-drama"]'
)

// A3. Multi-pôles : union des deux champs, sans doublon.
const multi = { pole: 'anime', poles: ['anime', 'gaming', 'danse'] }
verifier(
  'A3 · union poles + pole sans doublon',
  JSON.stringify(resolveUserPoles(multi)) === '["anime","gaming","danse"]',
  JSON.stringify(resolveUserPoles(multi))
)
verifier('A3b · pôle principal = premier pôle choisi', primaryPoleOf(multi) === 'anime')

const renverse = { pole: 'culture', poles: ['manga', 'gaming'] }
verifier(
  'A3c · poles prime sur un ancien pole obsolète',
  primaryPoleOf(renverse) === 'manga',
  `poles=${JSON.stringify(renverse.poles)} pole=${renverse.pole} → principal=${primaryPoleOf(renverse)}`
)

// A4. Nettoyage : doublons (« Gaming » + « gaming ») et pôles inconnus.
verifier(
  'A4 · doublons de casse retirés',
  JSON.stringify(sanitizePoles(['gaming', 'Gaming', 'GAMING'])) === '["gaming"]'
)
verifier('A4b · pôle inconnu rejeté (→ null)', toPoleSlug('pôle-bidon') === null)
verifier('A4c · libellé accepté comme slug (« K-Drama »)', toPoleSlug('K-Drama') === 'k-drama')
verifier(
  'A4d · liste mixte nettoyée',
  JSON.stringify(sanitizePoles(['Anime', 'gaming', 'bidon', 'anime'])) === '["anime","gaming"]'
)

// A5. Badges : libellés lisibles, jamais de slug nu.
verifier(
  'A5 · badges = libellés',
  JSON.stringify(poleLabelsOf(multi)) === '["Anime","Gaming","Danse"]',
  JSON.stringify(poleLabelsOf(multi))
)
verifier('A5b · texte replié', polesToText(multi) === 'Anime · Gaming · Danse')
verifier('A5c · aucun pôle → repli', polesToText({ pole: null, poles: [] }, 'Aucun pôle') === 'Aucun pôle')

console.log('\n=== B. PUBLICATION DANS LES 6 PÔLES ===')

// B1. Le schéma zod réellement appliqué par POST /api/communaute/posts
//     accepte chacun des 6 pôles (contenu minimal valide).
const poteauxRefuses: string[] = []
for (const slug of POLE_SLUGS) {
  const parsed = CommunityPostCreateSchema.safeParse({
    content: `Annonce de test du pôle ${slug}`,
    pole: slug
  })
  if (!parsed.success) poteauxRefuses.push(slug)
}
verifier(
  'B1 · les 6 pôles acceptés par le schéma d’annonce',
  poteauxRefuses.length === 0,
  poteauxRefuses.length ? `refusés : ${poteauxRefuses.join(', ')}` : 'anime, manga, gaming, danse, k-drama, culture'
)

// B2. La diffusion « tous les pôles » reste acceptée (écran dashboard-communication).
verifier(
  'B2 · « all » (tous les pôles) accepté',
  CommunityPostCreateSchema.safeParse({ content: 'Diffusion générale du club', pole: ALL_POLES }).success
)

// B3. Un pôle hors liste officielle est REFUSÉ (400 côté handler).
verifier(
  'B3 · pôle inconnu refusé',
  !CommunityPostCreateSchema.safeParse({ content: 'Annonce', pole: 'pole-bidon' }).success
)
verifier(
  'B4 · pôle manquant refusé',
  !CommunityPostCreateSchema.safeParse({ content: 'Annonce' }).success
)

// B5. VISIBILITÉ, pôle par pôle : l'annonce publiée dans un pôle apparaît
//     sous SON filtre et sous aucun autre (6 × 6 = 36 combinaisons).
const visibilites: string[] = []
for (const publie of POLE_SLUGS) {
  const visibles = POLE_SLUGS.filter(filtre => rawPoleMatches(publie, filtre))
  const bonCompte = visibles.length === 1 && visibles[0] === publie
  if (!bonCompte) visibilites.push(`${publie} → ${visibles.join('/') || 'invisible'}`)
}
verifier(
  'B5 · chaque pôle publié n’apparaît que sous son propre filtre',
  visibilites.length === 0,
  visibilites.length ? `anomalies : ${visibilites.join(' ; ')}` : '36 combinaisons vérifiées'
)

// B5b. L'inverse : chaque filtre de pôle voit bien sa propre annonce.
const filtresVides = POLE_SLUGS.filter(filtre => !rawPoleMatches(filtre, filtre))
verifier(
  'B5b · les 6 filtres voient leur propre annonce',
  filtresVides.length === 0,
  filtresVides.length ? `filtres vides : ${filtresVides.join(', ')}` : '6/6 filtres alimentés'
)

// B6. Une annonce « tous les pôles » est visible dans les 6 filtres.
const vusPartout = POLE_SLUGS.filter(filtre => rawPoleMatches(ALL_POLES, filtre))
verifier(
  'B6 · annonce « tous les pôles » visible dans les 6 filtres',
  vusPartout.length === 6,
  `${vusPartout.length}/6`
)

// B6b. Le filtre « tous les pôles » accepte n'importe quelle annonce à pôle.
verifier(
  'B6b · filtre « all » accepte les 6 pôles',
  POLE_SLUGS.every(slug => rawPoleMatches(slug, ALL_POLES))
)

// B7. Tolérance des libellés : une annonce historique « Anime » est visible
//     sous le filtre « anime ».
verifier('B7 · annonce « Anime » visible sous filtre anime', rawPoleMatches('Anime', 'anime'))
verifier('B7b · annonce « K-Drama » visible sous filtre k-drama', rawPoleMatches('K-Drama', 'k-drama'))
verifier('B7c · valeur composée « Culture générale »', rawPoleMatches('Culture générale', 'culture'))
verifier('B7d · pôle libre non apparenté reste exclu', !rawPoleMatches('Bidouille', 'manga'))

// B8. ANNUAIRE multi-pôles : un membre de deux pôles est visible sous les deux.
const membre = { pseudo: 'Neo', pole: 'danse', poles: ['danse', 'culture'] }
const apparaitSous = POLE_SLUGS.filter(filtre =>
  resolveUserPoles(membre).some(valeur => rawPoleMatches(valeur, filtre))
)
verifier(
  'B8 · membre multi-pôles visible sous ses 2 pôles seulement',
  apparaitSous.join(',') === 'danse,culture',
  apparaitSous.join(' · ')
)
const membreAncien = { pseudo: 'Legacy', pole: 'gaming', poles: [] as string[] }
verifier(
  'B8b · membre mono-pôle (ancien) toujours filtrable',
  POLE_SLUGS.filter(filtre => resolveUserPoles(membreAncien).some(v => rawPoleMatches(v, filtre))).join(',') === 'gaming'
)

// B9. ÉVÉNEMENTS à pôle : les 6 pôles passent le schéma réel.
const événementsRefusés: string[] = []
for (const slug of POLE_SLUGS) {
  const ok = EventCreateSchema.safeParse({
    title: `Événement ${slug}`,
    description: 'Description de test suffisamment longue.',
    location: 'ENEAM, Cotonou',
    pole: slug,
    start_date: '2026-10-01T10:00:00.000Z'
  }).success
  if (!ok) événementsRefusés.push(slug)
}
verifier(
  'B9 · les 6 pôles acceptés pour un événement',
  événementsRefusés.length === 0,
  événementsRefusés.length ? `refusés : ${événementsRefusés.join(', ')}` : '6/6'
)

console.log('\n=== C. CÂBLAGE RÉEL (assertions sur le source de production) ===')

const handlerPost = lire('server/api/communaute/posts/index.post.ts')
verifier(
  'C1 · POST /api/communaute/posts valide avec CommunityPostCreateSchema',
  handlerPost.includes('CommunityPostCreateSchema.safeParse')
)
verifier(
  'C2 · ...et écrit le pôle reçu sans liste blanche supplémentaire',
  /pole:\s*parsed\.data\.pole/.test(handlerPost) && !/POLE_SLUGS|POLE_VALUES/.test(handlerPost),
  'aucun filtre de pôle propre au handler : le schéma zod est la seule autorité'
)

const composer = lire('app/pages/communaute.vue')
const slugsDansComposer = POLE_SLUGS.filter(slug => new RegExp(`'${slug}':`).test(composer))
verifier(
  'C3 · les 6 pôles proposés par le composeur d’annonces',
  slugsDansComposer.length === 6,
  `${slugsDansComposer.join(' · ')}`
)
verifier(
  'C4 · le composeur envoie bien { content, pole } à l’API',
  composer.includes('body: { content, pole: composerPole.value }')
)
verifier(
  'C5 · le filtre du fil utilise la fonction partagée rawPoleMatches',
  composer.includes('rawPoleMatches')
)

const dashboardCom = lire('app/pages/dashboard-communication.vue')
const slugsDansDashboard = POLE_SLUGS.filter(slug => new RegExp(`'${slug}':`).test(dashboardCom))
verifier(
  'C6 · les 6 pôles proposés par le dashboard communication',
  slugsDansDashboard.length === 6,
  `${slugsDansDashboard.join(' · ')}`
)

const profil = lire('server/api/member/profile.patch.ts')
verifier(
  'C7 · PATCH /api/member/profile accepte « poles » et synchronise « pole »',
  profil.includes('poles: z.array(z.string())') && profil.includes('data: { poles: cleaned, pole: primary }')
)
verifier(
  'C8 · ...et refuse un pôle inconnu',
  profil.includes('Pôle inconnu')
)

const membresApi = lire('server/api/communaute/membres/index.get.ts')
verifier(
  'C9 · annuaire : filtre serveur sur les DEUX champs (pole OU poles)',
  membresApi.includes('poles: { has: requestedPole }') && membresApi.includes('pole: requestedPole')
)

const espaceMembre = lire('app/pages/espace-membre.vue')
verifier(
  'C10 · écran de profil : sélection multiple des 6 pôles',
  espaceMembre.includes('POLE_SLUGS.map') && espaceMembre.includes('v-model="selectedPoles"') &&
  espaceMembre.includes('type="checkbox"') && espaceMembre.includes('Enregistrer mes pôles')
)

console.log(`\n${total - echecs}/${total} vérifications passées.`)
if (echecs > 0) {
  console.log(`${echecs} ÉCHEC(S).`)
  process.exitCode = 1
} else {
  console.log('Aucune écriture en base : ce test ne touche ni Prisma ni PostgreSQL.')
}
