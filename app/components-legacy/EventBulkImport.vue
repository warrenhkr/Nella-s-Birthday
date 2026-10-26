<script setup lang="ts">
// MATRICE DES SOURCES — liste PARTAGÉE avec le serveur (shared/media-providers.ts).
// Avant, ce composant recopiait ses propres listes d'hôtes : Terabox y manquait,
// donc un lien Terabox valide était refusé à l'aperçu (défaut H1) et un dossier
// Terabox n'était jamais versé dans folder_urls (défaut H2).
import { estDossierPublic, estHoteVideoAccepte } from '#shared/media-providers'

// `xlsx` est chargé À LA DEMANDE (voir ProductBulkImport.vue) : l'import statique
// faisait échouer le rendu serveur sur Vercel et renvoyait une erreur 500 en
// production sur /dashboard-evenementiel.
async function loadXlsx() {
  return await import('xlsx')
}

const emit = defineEmits<{ imported: [] }>()
const { success, alert } = useGameToast()
type Row = Record<string, string>
type PreviewRow = { data: Row, line: number, errors: string[], status: 'valid' | 'invalid' | 'duplicate' }

type ImportSummary = {
  created: number
  mediaCreated?: number
  duplicates: number
  invalid: number
  ignored: number
  total: number
  reportCsv: string
  rows: Array<{ line: number, status: 'created' | 'duplicate' | 'invalid', message: string }>
}

const selectedFile = ref<File | null>(null)
const rows = ref<PreviewRow[]>([])
const pending = ref(false)
const parseError = ref('')
const lastSummary = ref<ImportSummary | null>(null)
const columns = ['title', 'description', 'location', 'type', 'start_date', 'end_date', 'status', 'capacity', 'price', 'is_free', 'payment_instructions', 'image_url', 'photo_urls', 'youtube_urls', 'video_urls', 'folder_urls']

const requiredColumns = [
  { label: 'title', aliases: ['title', 'titre', 'name'] },
  { label: 'description', aliases: ['description', 'details'] },
  { label: 'location', aliases: ['location', 'lieu', 'place'] },
  { label: 'type', aliases: ['type', 'categorie', 'category'] },
  { label: 'date', aliases: ['startdate', 'date', 'eventdate'] }
]

function normalizeDateCell(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(Math.round(value.getTime() / 1000) * 1000).toISOString()
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(Math.round(Date.UTC(1899, 11, 30) + value * 86400000) / 1000 * 1000).toISOString()
  return String(value ?? '').trim()
}

function keyOf(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function monthNumber(value: string) {
  const months = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre']
  return months.indexOf(keyOf(value))
}

function dateAtEndOfDay(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day, 23, 59, 59)).toISOString()
}

function parseHistoricalDate(value: string) {
  const normalized = value.trim()
  if (/^\d{4}-\d{2}-\d{2}(?:[T ]|$)/.test(normalized)) {
    const direct = new Date(normalized)
    if (!Number.isNaN(direct.getTime())) return { start: direct.toISOString(), end: dateAtEndOfDay(direct.getUTCFullYear(), direct.getUTCMonth(), direct.getUTCDate()) }
  }

  // Numéro de série Excel (« 45751 » = jours depuis le 30/12/1899).
  if (/^\d{5,6}$/.test(normalized)) {
    const serie = Number(normalized)
    const d = new Date(Date.UTC(1899, 11, 30) + serie * 86400000)
    const annee = d.getUTCFullYear()
    if (!Number.isNaN(d.getTime()) && annee >= 1990 && annee <= 2100) {
      return { start: d.toISOString(), end: dateAtEndOfDay(annee, d.getUTCMonth(), d.getUTCDate()) }
    }
  }

  const numericRange = normalized.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})\s*[-/]\s*(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
  if (numericRange) {
    const [, startDay = '', startMonth = '', startYear = '', endDay = '', endMonth = '', endYear = ''] = numericRange
    return {
      start: new Date(Date.UTC(Number(startYear), Number(startMonth) - 1, Number(startDay))).toISOString(),
      end: dateAtEndOfDay(Number(endYear), Number(endMonth) - 1, Number(endDay))
    }
  }

  const dayRange = normalized.match(/^(\d{1,2})(?:\s+au\s+(\d{1,2}))?\s+([a-zA-ZÀ-ÿ]+)\s+(\d{4})$/i)
  if (dayRange) {
    const [, firstDay = '', secondDay, monthName = '', year = ''] = dayRange
    const month = monthNumber(monthName)
    if (month >= 0) {
      return {
        start: new Date(Date.UTC(Number(year), month, Number(firstDay))).toISOString(),
        end: dateAtEndOfDay(Number(year), month, Number(secondDay || firstDay))
      }
    }
  }

  const monthRange = normalized.match(/^([\p{L}]+)(?:\s*[-–—/]\s*([\p{L}]+))?\s+(\d{4})$/iu)
  if (monthRange) {
    const [, firstMonth = '', secondMonth, year = ''] = monthRange
    const startMonth = monthNumber(firstMonth)
    const endMonth = monthNumber(secondMonth || firstMonth)
    if (startMonth >= 0 && endMonth >= 0) {
      const endYear = endMonth < startMonth ? Number(year) + 1 : Number(year)
      return {
        start: new Date(Date.UTC(Number(year), startMonth, 1)).toISOString(),
        end: dateAtEndOfDay(endYear, endMonth + 1, 0)
      }
    }
  }

  const fallback = new Date(normalized)
  if (!Number.isNaN(fallback.getTime())) {
    return {
      start: fallback.toISOString(),
      end: dateAtEndOfDay(fallback.getUTCFullYear(), fallback.getUTCMonth(), fallback.getUTCDate())
    }
  }

  return null
}

function findValue(row: Row, names: string[]) {
  const entry = Object.entries(row).find(([key]) => names.includes(keyOf(key)))
  return entry?.[1]?.trim() || ''
}

// NOTE : la détection « dossier public » n'est PLUS recopiée ici. La copie
// locale ignorait Terabox, donc un dossier Terabox collé dans image_url /
// photo_urls / video_urls n'était jamais versé dans folder_urls (défaut H2) :
// il partait en photoURL et devenait une vignette morte. `estDossierPublic`
// (shared/media-providers.ts) est la règle PARTAGÉE, identique au serveur.

function normalizeHistoricalRow(row: Row): Row {
  const normalized: Row = { ...row }
  normalized.title = normalized.title || findValue(row, ['title', 'titre', 'name'])
  normalized.description = normalized.description || findValue(row, ['description', 'details'])
  normalized.location = normalized.location || findValue(row, ['location', 'lieu', 'place'])
  normalized.type = normalized.type || findValue(row, ['type', 'categorie', 'category'])
  normalized.image_url = normalized.image_url || findValue(row, ['imageurl', 'image'])
  normalized.image_url = normalized.image_url || findValue(row, ['primaryimageurl', 'mainimageurl', 'coverurl', 'couverture'])
  normalized.folder_urls = normalized.folder_urls || findValue(row, ['folderurl', 'folderurls', 'dossier', 'dossiers'])
  normalized.video_urls = normalized.video_urls || findValue(row, ['videourl', 'videourls', 'youtubeurl', 'youtubeurls', 'video'])
  const inferredFolders = [normalized.image_url, normalized.photo_urls, normalized.video_urls]
    .flatMap(value => (value || '').split(/[|\n,]/).map(item => item.trim()).filter(estDossierPublic))
  normalized.folder_urls = [...new Set([...normalized.folder_urls.split(/[|\n,]/).map(value => value.trim()).filter(Boolean), ...inferredFolders])].join('|')
  const rawDate = findValue(row, ['date', 'eventdate'])
  if (!normalized.start_date && rawDate) {
    const parsedDate = parseHistoricalDate(rawDate)
    if (parsedDate) {
      normalized.start_date = parsedDate.start
      normalized.end_date = parsedDate.end
    }
  }
  normalized.type = [...new Set(normalized.type.split(/[,|\n]/).map(value => value.trim()).filter(Boolean))].join(', ')
  const rawPrice = normalized.price || findValue(row, ['price', 'prix'])
  normalized.price = rawPrice.replace(/[^0-9.]/g, '')
  normalized.is_free = normalized.is_free || (/(gratuit|free)/i.test(rawPrice) ? 'true' : normalized.price ? 'false' : 'true')
  return normalized
}

function rowsFromMatrix(matrix: unknown[][], headersOutput?: string[]): Row[] {
  if (matrix.length < 2) return []
  const headers = (matrix[0] || []).map(value => String(value ?? '').trim())
  headersOutput?.push(...headers)
  return matrix.slice(1).filter(row => row.some(cell => String(cell ?? '').trim())).map(row => Object.fromEntries(row.map((cell, index) => [headers[index] || `column_${index}`, ['start_date', 'end_date'].includes(headers[index] || '') ? normalizeDateCell(cell) : String(cell ?? '').trim()])))
}

function parseCsv(value: string): Row[] {
  const lines = value.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim())
  if (lines.length < 2) return []
  const parseLine = (line: string) => line.split(';').map(cell => cell.trim().replace(/^"|"$/g, '').replace(/""/g, '"'))
  return rowsFromMatrix([parseLine(lines[0] || ''), ...lines.slice(1).map(parseLine)])
}

function buildDuplicateKey(row: Row) {
  const title = (row.title || '').trim().toLowerCase()
  const location = (row.location || '').trim().toLowerCase()
  const startDate = (row.start_date || '').trim()
  return `${title}|${location}|${startDate}`
}

function downloadFile(filename: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function downloadCsvTemplate() {
  const sample = ['Atelier manga;Description historique obligatoire;ENEAM;anime;2025-06-01T09:00:00.000Z;2025-06-01T12:00:00.000Z;upcoming;;0;true;;;'].join(';')
  downloadFile('modele-evenements-historiques.csv', `${columns.join(';')}\n${sample}`, 'text/csv;charset=utf-8')
}

async function downloadExcelTemplate() {
  const XLSX = await loadXlsx()
  const worksheet = XLSX.utils.aoa_to_sheet([columns, ['Atelier manga', 'Description historique obligatoire', 'ENEAM', 'anime', '2025-06-01T09:00:00.000Z', '2025-06-01T12:00:00.000Z', 'upcoming', '', '0', 'true', '', '', '', '']])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Evenements')
  XLSX.writeFile(workbook, 'modele-evenements-historiques.xlsx')
}

function validate(row: Row): string[] {
  const errors: string[] = []
  if (!row.title?.trim() || row.title.trim().length < 3) errors.push('title obligatoire')
  if (!row.description?.trim() || row.description.trim().length < 10) errors.push('description obligatoire, 10 caractères minimum')
  if (!row.location?.trim()) errors.push('location obligatoire')
  if (!row.type?.trim()) errors.push('type obligatoire')
  const start = Date.parse(row.start_date || '')
  const end = Date.parse(row.end_date || '')
  if (Number.isNaN(start)) errors.push('start_date invalide')
  if (Number.isNaN(end) || end <= start) errors.push('end_date doit suivre start_date')
  if (row.status && !['upcoming', 'cancelled', 'postponed'].includes(row.status.toLowerCase())) errors.push(`status invalide : « ${row.status} » (utilisez upcoming, cancelled ou postponed)`)
  if (row.is_free !== 'true' && row.is_free !== 'false') errors.push('is_free doit être true ou false')
  const imageUrls = [...(row.image_url ? [row.image_url] : []), ...(row.photo_urls || '').split(/[|\n,]/).map(value => value.trim()).filter(Boolean)]
  imageUrls.forEach((url, index) => {
    try {
      const parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
    } catch {
      errors.push(`image ${index + 1} invalide : « ${url} »`)
    }
  })
  const videoUrls = [...(row.youtube_urls || '').split(/[|\n,]/), ...(row.video_urls || '').split(/[|\n,]/)].map(value => value.trim()).filter(Boolean)
  videoUrls.forEach((url, index) => {
    // MATRICE DES SOURCES : pCloud + YouTube + Terabox (+ Vimeo, Dailymotion,
    // Twitch, Google Drive déjà en base). Cette liste était RECOPIÉE ici et
    // avait divergé : Terabox en était absent, donc un lien Terabox valide
    // était refusé à l'aperçu (« plateforme non supportée ») alors que le
    // serveur l'acceptait (défaut H1). Une seule liste désormais.
    if (!estHoteVideoAccepte(url)) {
      errors.push(`vidéo ${index + 1} invalide : plateforme non supportée (« ${url} ») — sources vidéo : pCloud, YouTube ou Terabox`)
    }
  })
  return errors
}

function revalidate(row: PreviewRow) {
  row.errors = validate(row.data)
  row.status = row.errors.length ? 'invalid' : 'valid'
  markDuplicates(rows.value)
}

function recoverDate(row: PreviewRow) {
  const parsedDate = parseHistoricalDate(findValue(row.data, ['date', 'eventdate']))
  if (!parsedDate) return
  row.data.start_date = parsedDate.start
  row.data.end_date = parsedDate.end
}

function revalidateAll() {
  rows.value.forEach((row) => {
    row.errors = validate(row.data)
    row.status = row.errors.length ? 'invalid' : 'valid'
  })
  markDuplicates(rows.value)
}

function recoverAllDates() {
  rows.value.forEach(recoverDate)
  revalidateAll()
}

function folderCount(row: PreviewRow) {
  return (row.data.folder_urls || '').split(/[|\n,]/).map(value => value.trim()).filter(Boolean).length
}

function markDuplicates(rowsToCheck: PreviewRow[]) {
  const seen = new Map<string, number>()
  rowsToCheck.forEach((row) => {
    if (row.errors.length > 0) {
      row.status = 'invalid'
      return
    }
    const key = buildDuplicateKey(row.data)
    const firstLine = seen.get(key)
    if (firstLine) {
      row.status = 'duplicate'
      row.errors.push(`doublon détecté (ligne ${firstLine})`)
      return
    }
    seen.set(key, row.line)
    row.status = 'valid'
  })
}

async function onFileChange(fileValue: File | File[] | null | undefined) {
  const file = Array.isArray(fileValue) ? fileValue[0] : fileValue
  if (!file) return
  parseError.value = ''
  lastSummary.value = null
  try {
    const isExcel = /\.(xlsx|xls)$/i.test(file.name)
    let importedRows: Row[]
    const importedHeaders: string[] = []
    if (isExcel) {
      const XLSX = await loadXlsx()
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined
      importedRows = worksheet
        ? rowsFromMatrix(XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: '' }) as unknown[][], importedHeaders)
        : []
    } else {
      const csv = await file.text()
      const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim())
      importedRows = parseCsv(csv)
      if (lines[0]) importedHeaders.push(...lines[0].split(';').map(header => header.trim().replace(/^"|"$/g, '')))
    }
    const normalizedHeaders = importedHeaders.map(keyOf)
    const missingColumns = requiredColumns.filter(column => !column.aliases.some(alias => normalizedHeaders.includes(alias))).map(column => column.label)
    if (!importedRows.length || missingColumns.length) {
      parseError.value = missingColumns.length
        ? `Colonnes manquantes : ${missingColumns.join(', ')}. Télécharge le modèle correspondant.`
        : 'Le fichier ne contient aucune ligne exploitable.'
      rows.value = []
      return
    }
    const previewRows = importedRows.map((row, index) => {
      const normalizedRow = normalizeHistoricalRow(row)
      return { data: normalizedRow, line: index + 2, errors: validate(normalizedRow), status: 'valid' as const }
    })
    markDuplicates(previewRows)
    rows.value = previewRows
  } catch {
    parseError.value = 'Fichier illisible : vérifie qu’il s’agit d’un CSV, XLSX ou XLS non protégé et utilise le modèle fourni.'
    rows.value = rows.value.filter(row => row.errors.length > 0 || row.status === 'duplicate')
  }
}

function downloadReport() {
  if (!lastSummary.value) return
  const data = lastSummary.value.reportCsv
  const blob = new Blob([data], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'rapport-import-evenements.csv'
  link.click()
  URL.revokeObjectURL(url)
}

async function importEvents() {
  const validRows = rows.value.filter(row => row.errors.length === 0 && row.status === 'valid')
  if (!validRows.length) return alert('Aucune ligne valide à importer.')
  pending.value = true
  try {
    const response = await $fetch<ImportSummary>('/api/events/bulk', {
      method: 'POST',
      body: {
        events: validRows.map(row => row.data),
        sourceFileName: selectedFile.value?.name,
        sourceFormat: selectedFile.value?.name.split('.').pop()?.toLowerCase()
      }
    })

    lastSummary.value = response
    success(`${response.created} événement(s) importé(s), ${response.duplicates} doublon(s), ${response.invalid} ligne(s) refusée(s).`)
    rows.value = []
    selectedFile.value = null
    emit('imported')
  } catch (error: unknown) {
    alert(error instanceof Error ? error.message : 'Import impossible.')
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <section class="surface-solid clip-corner p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-xs uppercase tracking-[0.2em] text-brand">
          Archives
        </p>
        <h2
          class="mt-2 text-2xl font-semibold"
          style="color: var(--text-color);"
        >
          Importer des événements passés
        </h2>
        <p class="mt-1 text-sm text-muted">
          Colonne principale recommandée : <strong>image_url</strong> pour la couverture de l’événement. Cette valeur est prioritaire et les anciens alias <strong>primary_image_url</strong>, <strong>cover_url</strong> et <strong>couverture</strong> restent acceptés. Les formats .csv, .xlsx et .xls sont acceptés. Matrice des sources — <strong>images</strong> : pCloud (publink de dossier) et Terabox (partage public) ; <strong>vidéos</strong> : pCloud, YouTube et Terabox. Un dossier public est parcouru et un média est créé par fichier.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-file-spreadsheet"
          label="Modèle CSV"
          @click="downloadCsvTemplate"
        />
        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-file-spreadsheet"
          label="Modèle Excel"
          @click="downloadExcelTemplate"
        />
      </div>
    </div>
    <UFileUpload
      v-model="selectedFile"
      class="mt-5 w-full"
      accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
      label="Déposer votre fichier d’import ici"
      description="CSV, XLSX ou XLS · 1 fichier à la fois"
      @update:model-value="onFileChange"
    />
    <p
      v-if="parseError"
      class="mt-3 text-sm text-red-500"
    >
      {{ parseError }}
    </p>
    <div
      v-if="lastSummary"
      class="mt-4 rounded-lg border border-green-500/30 bg-green-500/5 p-3 text-sm"
    >
      <p class="font-semibold text-green-700">
        Résultat de l’import
      </p>
      <p class="mt-1 text-muted">
        {{ lastSummary.created }} événement(s) créé(s) · {{ lastSummary.mediaCreated || 0 }} média(s) ajouté(s) à la galerie · {{ lastSummary.duplicates }} doublon(s) · {{ lastSummary.invalid }} erreur(s).
      </p>
    </div>

    <div
      v-if="rows.length"
      class="mt-5 space-y-4"
    >
      <div class="flex flex-wrap gap-3 text-xs text-muted">
        <span class="rounded-full border border-default px-2 py-1">Validées : {{ rows.filter(row => row.status === 'valid').length }}</span>
        <span class="rounded-full border border-default px-2 py-1">Invalides : {{ rows.filter(row => row.status === 'invalid').length }}</span>
        <span class="rounded-full border border-default px-2 py-1">Doublons : {{ rows.filter(row => row.status === 'duplicate').length }}</span>
      </div>

      <div class="flex flex-wrap gap-2">
        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-calendar-check"
          label="Récupérer les dates reconnues"
          @click="recoverAllDates"
        />
        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-refresh-cw"
          label="Revalider toutes les lignes"
          @click="revalidateAll"
        />
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-290 text-left text-sm">
          <thead>
            <tr class="border-b border-default">
              <th class="p-2">
                Ligne
              </th>
              <th class="p-2">
                Titre
              </th>
              <th class="p-2">
                Description
              </th>
              <th class="p-2">
                Lieu
              </th>
              <th class="p-2">
                Type
              </th>
              <th class="p-2">
                Image principale
              </th>
              <th class="p-2">
                Début
              </th>
              <th class="p-2">
                Fin
              </th>
              <th class="p-2">
                Validation
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="row.line"
              class="border-b border-default/50"
            >
              <td class="p-2">
                {{ row.line }}
              </td>
              <td class="min-w-48 p-2">
                <UInput
                  v-model="row.data.title"
                  size="sm"
                  aria-label="Titre de l'événement"
                  @update:model-value="revalidate(row)"
                />
              </td>
              <td class="min-w-64 p-2">
                <UTextarea
                  v-model="row.data.description"
                  :rows="2"
                  aria-label="Description de l'événement"
                  @update:model-value="revalidate(row)"
                />
              </td>
              <td class="min-w-40 p-2">
                <UInput
                  v-model="row.data.location"
                  size="sm"
                  aria-label="Lieu de l'événement"
                  @update:model-value="revalidate(row)"
                />
              </td>
              <td class="min-w-48 p-2">
                <UInput
                  v-model="row.data.type"
                  size="sm"
                  aria-label="Types de l'événement"
                  @update:model-value="revalidate(row)"
                />
              </td>
              <td class="min-w-64 p-2">
                <UInput
                  v-model="row.data.image_url"
                  size="sm"
                  aria-label="URL de l'image principale"
                  placeholder="URL de couverture"
                  @update:model-value="revalidate(row)"
                />
                <p class="mt-1 text-[11px] text-muted">
                  Cette URL sera la couverture de l’événement.
                </p>
              </td>
              <td class="min-w-52 p-2">
                <UInput
                  v-model="row.data.start_date"
                  size="sm"
                  aria-label="Date de début"
                  @update:model-value="revalidate(row)"
                />
              </td>
              <td class="min-w-52 p-2">
                <UInput
                  v-model="row.data.end_date"
                  size="sm"
                  aria-label="Date de fin"
                  @update:model-value="revalidate(row)"
                />
              </td>
              <td class="p-2">
                <span
                  v-if="!row.errors.length"
                  :class="row.status === 'valid' ? 'text-green-600' : row.status === 'duplicate' ? 'text-amber-600' : 'text-red-500'"
                >
                  Valide
                </span>
                <ul
                  v-if="row.errors.length"
                  class="mt-2 list-disc space-y-1 pl-4 text-xs text-red-500"
                >
                  <li
                    v-for="errorMessage in row.errors"
                    :key="errorMessage"
                  >
                    {{ errorMessage }}
                  </li>
                </ul>
                <p
                  v-if="folderCount(row)"
                  class="mt-2 text-xs text-[var(--primary-color)]"
                >
                  {{ folderCount(row) }} dossier(s) public(s) détecté(s) pour recherche d’images.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex flex-wrap gap-3">
        <UButton
          class="mt-2"
          color="primary"
          :loading="pending"
          :disabled="rows.every(row => row.status !== 'valid')"
          label="Importer les lignes valides"
          @click="importEvents"
        />
        <UButton
          v-if="lastSummary"
          color="neutral"
          variant="soft"
          label="Télécharger le rapport"
          @click="downloadReport"
        />
      </div>
    </div>
  </section>
</template>
