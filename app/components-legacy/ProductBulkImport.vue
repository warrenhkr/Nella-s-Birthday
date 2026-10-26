<script setup lang="ts">
// MATRICE DES SOURCES (shared/media-providers.ts) : mêmes règles que la route
// serveur /api/boutique/catalog/bulk — sources images : pCloud + Terabox.
import { estLienPcloudDirectLieAIp, natureLienMedia } from '#shared/media-providers'

// `xlsx` est chargé À LA DEMANDE, uniquement quand l'utilisateur clique
// (import/export Excel) : son import statique faisait échouer le rendu serveur
// sur Vercel (« Cannot find module .../xlsx/dist/cpexcel.js »), ce qui renvoyait
// une erreur 500 en production sur /boutique-dashboard et /dashboard-evenementiel.
async function loadXlsx() {
  return await import('xlsx')
}

const emit = defineEmits<{ imported: [] }>()
const { success, alert } = useGameToast()

type Row = Record<string, string>
type PreviewRow = { data: Row, line: number, errors: string[], status: 'valid' | 'invalid' | 'duplicate' }
type ImportSummary = {
  created: number
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

const columns = ['name', 'description', 'category', 'price', 'stock', 'whatsapp_number', 'image_url', 'image_url_2', 'image_url_3']

function rowsFromMatrix(matrix: unknown[][]): Row[] {
  if (matrix.length < 2) return []
  const headers = (matrix[0] || []).map(value => String(value ?? '').trim())
  return matrix.slice(1).filter(row => row.some(cell => String(cell ?? '').trim())).map(row => Object.fromEntries(row.map((cell, index) => [headers[index] || `column_${index}`, String(cell ?? '').trim()])))
}

function parseCsv(value: string): Row[] {
  const lines = value.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim())
  if (lines.length < 2) return []
  const parseLine = (line: string) => line.split(';').map(cell => cell.trim().replace(/^"|"$/g, '').replace(/""/g, '"'))
  return rowsFromMatrix([parseLine(lines[0] || ''), ...lines.slice(1).map(parseLine)])
}

function buildDuplicateKey(row: Row) {
  return `${(row.name || '').trim().toLowerCase()}|${(row.category || '').trim().toLowerCase()}|${(row.price || '').trim()}`
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
  downloadFile('modele-produits.csv', `${columns.join(';')}\nT-shirt Club;Description d'au moins 10 caracteres;goodies;12000;10;+22997000000;;;`, 'text/csv;charset=utf-8')
}

async function downloadExcelTemplate() {
  const XLSX = await loadXlsx()
  const worksheet = XLSX.utils.aoa_to_sheet([columns, ['T-shirt Club', 'Description d\'au moins 10 caracteres', 'goodies', '12000', '10', '+22997000000', '', '', '']])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Produits')
  XLSX.writeFile(workbook, 'modele-produits.xlsx')
}

function validate(row: Row): string[] {
  const errors: string[] = []
  if (!row.name?.trim() || row.name.trim().length < 3) errors.push('name obligatoire, 3 caractères minimum')
  if (!row.description?.trim() || row.description.trim().length < 10) errors.push('description obligatoire, 10 caractères minimum')
  const category = row.category?.trim() || ''
  if (!category) errors.push('category obligatoire')
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category)) errors.push('category invalide (minuscules et tirets uniquement, ex. goodies)')
  if (!/^\d+$/.test(row.price || '') || Number(row.price) <= 0) errors.push('price doit être un entier positif')
  if (!/^\d+$/.test(row.stock || '')) errors.push('stock doit être un entier positif ou nul')
  if (!/^\+[1-9]\d{7,14}$/.test(row.whatsapp_number || '')) errors.push('whatsapp_number invalide')
  // MATRICE DES SOURCES IMAGES : pCloud + Terabox (leurs partages publics sont
  // parcourus par le serveur). Les règles ci-dessous sont celles de la route
  // serveur (shared/media-providers.ts) : l'aperçu ne laisse plus passer ce que
  // l'import refusera, et inversement.
  for (const key of ['image_url', 'image_url_2', 'image_url_3']) {
    const valeur = (row[key] || '').trim()
    if (!valeur) continue
    if (!/^https?:\/\//i.test(valeur)) {
      errors.push(`${key} doit être une URL (https://…)`)
      continue
    }
    // MÊME VERDICT QUE LA ROUTE SERVEUR (server/api/boutique/catalog/bulk.post.ts) :
    // image directe, dossier public pCloud ou Terabox acceptés ; vidéo, lien
    // non média et lien pCloud direct (lié à l’IP, il casserait en production)
    // refusés AVANT l’import, avec le motif.
    const nature = natureLienMedia(valeur)
    if (nature === 'VIDEO') {
      errors.push(`${key} : une vidéo ne peut pas servir de visuel produit (${valeur})`)
      continue
    }
    if (nature === 'INCONNU') {
      errors.push(`${key} : lien image non reconnu — attendu une image JPG/PNG/WebP/GIF/BMP/AVIF, un dossier public pCloud ou Terabox, ou une URL Google Drive`)
      continue
    }
    if (estLienPcloudDirectLieAIp(valeur)) {
      errors.push(`${key} : lien pCloud direct refusé (lié à l’adresse IP qui l’a créé) — utilisez le publink du dossier`)
    }
  }
  return errors
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

function revalidate(row: PreviewRow) {
  row.errors = validate(row.data)
  row.status = row.errors.length ? 'invalid' : 'valid'
  markDuplicates(rows.value)
}

function revalidateAll() {
  rows.value.forEach((row) => {
    row.errors = validate(row.data)
    row.status = row.errors.length ? 'invalid' : 'valid'
  })
  markDuplicates(rows.value)
}

async function onFileChange(fileValue: File | File[] | null | undefined) {
  const file = Array.isArray(fileValue) ? fileValue[0] : fileValue
  if (!file) return
  parseError.value = ''
  lastSummary.value = null
  try {
    const isExcel = /\.(xlsx|xls)$/i.test(file.name)
    let importedRows: Row[]
    if (isExcel) {
      const XLSX = await loadXlsx()
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined
      importedRows = worksheet
        ? rowsFromMatrix(XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' }) as unknown[][])
        : []
    } else {
      importedRows = parseCsv(await file.text())
    }
    const previewRows = importedRows.map((row, index) => ({ data: row, line: index + 2, errors: validate(row), status: 'valid' as const }))
    markDuplicates(previewRows)
    rows.value = previewRows
  } catch {
    parseError.value = 'CSV invalide.'
    rows.value = []
  }
}

function downloadReport() {
  if (!lastSummary.value) return
  const blob = new Blob([lastSummary.value.reportCsv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'rapport-import-produits.csv'
  link.click()
  URL.revokeObjectURL(url)
}

async function importProducts() {
  const validRows = rows.value.filter(row => row.errors.length === 0 && row.status === 'valid')
  if (!validRows.length) return alert('Aucune ligne valide à importer.')
  pending.value = true
  try {
    const response = await $fetch<ImportSummary>('/api/boutique/catalog/bulk', {
      method: 'POST',
      body: { products: validRows.map(row => row.data) }
    })
    lastSummary.value = response
    success(`${response.created} produit(s) importé(s), ${response.duplicates} doublon(s), ${response.invalid} ligne(s) refusée(s).`)
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
          Import catalogue
        </p>
        <h2
          class="mt-2 text-2xl font-semibold"
          style="color: var(--text-color);"
        >
          Ajouter plusieurs produits
        </h2>
        <p class="mt-1 text-sm text-muted">
          Choisis le modèle CSV ou Excel, remplis une ligne par produit, puis importe le fichier pour prévisualiser les erreurs. Visuels acceptés : image directe, dossier public pCloud ou Terabox (parcouru automatiquement, un visuel par fichier) — une vidéo ne peut pas servir de visuel produit. Formats .csv, .xlsx et .xls acceptés. Sources des visuels (<strong>image_url</strong>, <strong>image_url_2</strong>, <strong>image_url_3</strong>) : <strong>pCloud</strong> (publink de dossier) et <strong>Terabox</strong> (partage public) — un dossier public est parcouru et ses images sont importées ; un lien pCloud direct est refusé car il casse en production.
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
      v-if="rows.length"
      class="mt-5 space-y-4"
    >
      <div class="flex flex-wrap gap-3 text-xs text-muted">
        <span class="rounded-full border border-default px-2 py-1">Validées : {{ rows.filter(row => row.status === 'valid').length }}</span>
        <span class="rounded-full border border-default px-2 py-1">Invalides : {{ rows.filter(row => row.status === 'invalid').length }}</span>
        <span class="rounded-full border border-default px-2 py-1">Doublons : {{ rows.filter(row => row.status === 'duplicate').length }}</span>
      </div>

      <UButton
        color="neutral"
        variant="soft"
        icon="i-lucide-refresh-cw"
        label="Revalider toutes les lignes"
        @click="revalidateAll"
      />

      <div class="overflow-x-auto">
        <table class="w-full min-w-[760px] text-left text-sm sm:min-w-[1080px]">
          <thead>
            <tr class="border-b border-default">
              <th class="p-2">
                Ligne
              </th>
              <th class="p-2">
                Produit
              </th>
              <th class="p-2">
                Description
              </th>
              <th class="p-2">
                Catégorie
              </th>
              <th class="p-2">
                Prix
              </th>
              <th class="p-2">
                Stock
              </th>
              <th class="p-2">
                WhatsApp
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
                  v-model="row.data.name"
                  size="sm"
                  aria-label="Nom du produit"
                  @update:model-value="revalidate(row)"
                />
              </td>
              <td class="min-w-64 p-2">
                <UTextarea
                  v-model="row.data.description"
                  :rows="2"
                  aria-label="Description du produit"
                  @update:model-value="revalidate(row)"
                />
              </td>
              <td class="min-w-36 p-2">
                <UInput
                  v-model="row.data.category"
                  size="sm"
                  aria-label="Catégorie du produit"
                  @update:model-value="revalidate(row)"
                />
              </td>
              <td class="min-w-28 p-2">
                <UInput
                  v-model="row.data.price"
                  size="sm"
                  aria-label="Prix du produit"
                  @update:model-value="revalidate(row)"
                />
              </td>
              <td class="min-w-24 p-2">
                <UInput
                  v-model="row.data.stock"
                  size="sm"
                  aria-label="Stock du produit"
                  @update:model-value="revalidate(row)"
                />
              </td>
              <td class="min-w-44 p-2">
                <UInput
                  v-model="row.data.whatsapp_number"
                  size="sm"
                  aria-label="WhatsApp du produit"
                  @update:model-value="revalidate(row)"
                />
              </td>
              <td class="p-2">
                <span
                  :class="row.status === 'valid' ? 'text-green-600' : row.status === 'duplicate' ? 'text-amber-600' : 'text-red-500'"
                >
                  {{ row.errors.length ? row.errors.join(' · ') : 'Valide' }}
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
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-xs text-muted">
        Sur mobile, fais glisser le tableau horizontalement pour voir toutes les colonnes.
      </p>

      <div class="flex flex-wrap gap-3">
        <UButton
          class="mt-2"
          color="primary"
          :loading="pending"
          :disabled="rows.every(row => row.status !== 'valid')"
          label="Importer les lignes valides"
          @click="importProducts"
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
