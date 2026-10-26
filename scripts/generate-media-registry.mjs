import { spawnSync } from 'node:child_process'
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const outputPath = path.join(projectRoot, 'app', 'data', 'media.ts')
const sources = [
  { directory: 'public/media/photos', type: 'photo' },
  { directory: 'public/imgs', type: 'photo' },
  { directory: 'public/media/videos', type: 'video' },
  { directory: 'public/Vidéos', type: 'video' }
]
const supportedExtensions = new Set([
  '.avif', '.gif', '.jpeg', '.jpg', '.m4v', '.mov', '.mp4', '.png', '.webm', '.webp'
])

async function listFiles(directory) {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }

  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'gallery-video-posters') return []
      return listFiles(fullPath)
    }
    return entry.isFile() && supportedExtensions.has(path.extname(entry.name).toLowerCase())
      ? [fullPath]
      : []
  }))

  return files.flat()
}

function inspectMedia(filePath) {
  const result = spawnSync('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height:format=duration',
    '-of', 'json',
    filePath
  ], { encoding: 'utf8', windowsHide: true })

  if (result.error || result.status !== 0) return null

  try {
    const metadata = JSON.parse(result.stdout)
    const stream = metadata.streams?.[0]
    const duration = Number(metadata.format?.duration)
    return {
      width: Number.isInteger(stream?.width) ? stream.width : null,
      height: Number.isInteger(stream?.height) ? stream.height : null,
      durationSeconds: Number.isFinite(duration) ? Math.round(duration * 100) / 100 : null
    }
  } catch {
    return null
  }
}

const discovered = await Promise.all(sources.map(async ({ directory, type }) => {
  const fullDirectory = path.join(projectRoot, directory)
  const files = await listFiles(fullDirectory)
  return files.map(filePath => ({ filePath, type }))
}))

const assets = discovered.flat()
  .sort((left, right) => left.filePath.localeCompare(right.filePath, 'en'))
  .map(({ filePath, type }) => {
    const relativePath = path.relative(path.join(projectRoot, 'public'), filePath).split(path.sep).join('/')
    const filename = path.basename(filePath)
    const metadata = inspectMedia(filePath)
    const base = {
      id: path.basename(filename, path.extname(filename)).replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase(),
      file: filename,
      src: `/${relativePath}`,
      type,
      width: metadata?.width ?? null,
      height: metadata?.height ?? null,
      caption: ''
    }

    return type === 'video'
      ? { ...base, durationSeconds: metadata?.durationSeconds ?? null }
      : base
  })

const mediaType = `export type MediaAsset = {
  id: string
  file: string
  src: string
  poster?: string
  type: 'photo' | 'video'
  width: number | null
  height: number | null
  caption: string
  durationSeconds?: number | null
}

`
const quoteString = (value) => {
  const escapedValue = value
    .replaceAll('\\', '\\\\')
    .replaceAll(String.fromCharCode(39), `\\${String.fromCharCode(39)}`)
  return `'${escapedValue}'`
}
const serializedAssets = assets.map((asset) => {
  const properties = Object.entries(asset)
    .map(([key, value]) => `    ${key}: ${typeof value === 'string' ? quoteString(value) : value}`)
  return `  {\n${properties.join(',\n')}\n  }`
})
const content = `${mediaType}export const media: MediaAsset[] = [\n${serializedAssets.join(',\n')}\n]\n`

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, content, 'utf8')
console.log(`Registre média généré : ${assets.length} fichier(s) -> ${path.relative(projectRoot, outputPath)}`)
