import { richTextLength, toSafeHtml } from '../../shared/rich-text'

/**
 * Longueur du TEXTE d'un contenu riche enregistré en base.
 * ---------------------------------------------------------------------------
 * POURQUOI CE FICHIER DÉLÈGUE À shared/rich-text.ts
 * L'ancienne version ne savait lire QUE l'ancien JSON Tiptap : sur du HTML (le
 * format réellement produit par l'éditeur), elle renvoyait la longueur BRUTE,
 * balisage compris. Conséquence : « au moins 10 caractères » était validable
 * avec `<p></p><p></p>` (balises seules), et une description de 1 900 caractères
 * de texte était refusée au-delà de 2 000 caractères d'HTML.
 *
 * Une seule mesure désormais, partagée par l'éditeur (compteur), l'affichage et
 * l'API : `richTextLength` sur du HTML nettoyé par `toSafeHtml` (qui continue de
 * comprendre l'ancien JSON Tiptap, le HTML et le texte brut).
 */
export function getRichTextLength(value: string): number {
  if (typeof value !== 'string') return 0
  return richTextLength(toSafeHtml(value))
}
