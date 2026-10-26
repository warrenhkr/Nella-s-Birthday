export const productCategories = [
  { value: 'figurines', label: 'Figurines' },
  { value: 'manga', label: 'Manga' },
  { value: 'goodies', label: 'Goodies' },
  { value: 'vetements', label: 'Vêtements' },
  { value: 'accessoires', label: 'Accessoires' },
  { value: 'posters-decoration', label: 'Posters et décoration' },
  { value: 'papeterie', label: 'Papeterie' },
  { value: 'jeux', label: 'Jeux' },
  { value: 'cosplay', label: 'Cosplay' },
  { value: 'cartes-collection', label: 'Cartes à collectionner' },
  { value: 'autre', label: 'Autre' }
] as const

export type ProductCategory = typeof productCategories[number]['value']
