#!/usr/bin/env node
// ============================================================
// generate-bgm.mjs — génère les 3 boucles de musique de fond du site
// Club Otaku ENEAM par SYNTHÈSE PURE (ffmpeg lavfi : aevalsrc / anoisesrc).
//
// Aucun fichier téléchargé, aucune oeuvre tierce : chaque échantillon est
// calculé par une expression mathématique -> pistes originales, libres de droits.
//
// BOUCLE PARFAITE (voir docs/ASSETS-A-FOURNIR.md)
//   - L = 76.8 s. Toute fréquence est un multiple entier de 1/L (K entier,
//     f = K/L) : chaque partiel est exactement L-périodique, sans fondu aux
//     extrémités -> raccord mathématiquement continu, aucun clic.
//   - Toutes les enveloppes sont fonctions de mod(t, P), P divisant L, et
//     s'annulent aux bornes de leur créneau.
//   - La nappe utilise des fenêtres de Hann sin^2 à recouvrement 50 % (COLA :
//     la somme des fenêtres vaut exactement 1) -> fondus croisés entre accords.
//   - Le bruit (charley/shaker) n'est pas périodique : chaque impact est borné
//     dans son créneau (start + len <= P), donc la porte vaut exactement 0 de
//     part et d'autre du point de bouclage.
//
// PERFORMANCES : aevalsrc est un interpréteur d'expressions (~270 000
// évaluations de terme/seconde). Chaque « unité » (3-4 termes maximum) est donc
// rendue dans un process ffmpeg séparé, en parallèle, puis les unités sont
// mixées par une passe ffmpeg compilée (rapide).
//
// VÉRIFICATIONS : chaque unité tonale est rendue deux fois (2*L) et ses deux
// moitiés sont comparées échantillon par échantillon (preuve de périodicité) ;
// le mix final est testé au point de raccord (recherche de clic).
//
// Usage : node scripts/generate-bgm.mjs [bgm-01|bgm-02|bgm-03]
// ============================================================

import { execFile } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { cpus } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const ROOT = process.cwd()
const OUT_MP3 = join(ROOT, 'public', 'audio')
const OUT_BUILD = join(ROOT, 'build', 'bgm')
const FG_DIR = join(ROOT, 'scripts', 'bgm')
const CPU = Math.max(2, cpus().length)
const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg'

const L = 76.8 // durée de la boucle (s)
const SR = 44100
const SR_CHECK = 8000 // échantillonnage réduit pour le test de périodicité
const TAU = Math.PI * 2
const W1 = TAU / L
const MP3_BITRATE = '112k'
// Cible de loudness : les 3 pistes sont enchaînées dans une même playlist, elles
// doivent donc sonner aussi fort l'une que l'autre (RMS constant, plafond anti-écretage).
const TARGET_MEAN_DB = -20
const PEAK_CEILING_DB = -1
// Pré-roulage des filtres (réverbération/délai) : le filtre est rendu sur
// L + WARMUP puis rogné sur [WARMUP, WARMUP+L]. Sans lui, l'absence d'« histoire »
// à t=0 produisait une marche audible au point de bouclage.
const WARMUP = 1

// ---------- helpers numériques / expressions ----------
const num = (x, d = 9) => {
  const s = Number(x).toFixed(d)
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s
}
const K = (freq) => Math.max(1, Math.round(freq * L)) // f = K/L (périodicité exacte)
const omega = (freq) => num(W1 * K(freq), 12)
const semi = (n) => 440 * Math.pow(2, n / 12)

function positiveShift(start, period) {
  const off = ((start % period) + period) % period
  return off === 0 ? 0 : period - off
}
function colaWindow(start, hop) {
  const period = 2 * hop
  const shift = positiveShift(start, period)
  return `pow(sin(${num(Math.PI / period, 12)}*mod(t+${num(shift, 9)},${num(period, 9)})),2)`
}
function hitEnv(start, period, len, decay, fade) {
  const u = `mod(t+${num(positiveShift(start, period), 9)},${num(period, 9)})`
  const f = num(fade, 5)
  return `(max(0,min(1,${u}/${f}))*max(0,min(1,(${num(len, 5)}-${u})/${f}))*exp(-${num(decay, 5)}*${u}))`
}
const voice = (freq, env, amp) => `${num(amp, 5)}*${env}*sin(${omega(freq)}*t)`

// Le créneau d'un impact doit se refermer avant la fin de sa période, sinon la
// porte ne serait pas nulle au point de bouclage.
function assertBounded(start, period, len, what) {
  const off = ((start % period) + period) % period
  if (off + len > period + 1e-9) {
    throw new Error(`impact hors créneau (${what}) : start=${start} len=${len} period=${period}`)
  }
}

// ---------- grains musicaux ----------
const NOTE = {
  A1: -36, E2: -29, F2: -28, 'F#2': -27, G2: -26, A2: -24, B2: -22, C3: -21,
  'C#3': -20, D3: -19, E3: -17, F3: -16, 'F#3': -15, G3: -14, A3: -12, B3: -10,
  C4: -9, 'C#4': -8, D4: -7, E4: -5, F4: -4, 'F#4': -3, G4: -2, A4: 0, B4: 2,
  C5: 3, D5: 5, E5: 7, F5: 8, 'F#5': 9, G5: 10, A5: 12
}
const f = (name) => {
  const v = NOTE[name]
  if (v === undefined) throw new Error(`note inconnue dans NOTE : ${name}`)
  return semi(v)
}
// 'F3x' -> 'F#3' (notation dièse sans caractère spécial dans les tableaux)
const normalizeNote = (name) => {
  const m = /^([A-G])([0-9])x$/.exec(name)
  return m ? `${m[1]}#${m[2]}` : name
}

const chunk = (arr, size) => {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ---------- définitions des 3 pistes ----------
const TRACKS = [
  {
    file: 'bgm-01',
    title: 'Calme — nappe Am/F/C/G, basse tenue, arpège pentatonique, sans percussion',
    seed: 101,
    hop: 19.2,
    chords: [
      ['A3', 'C4', 'E4'], // Am
      ['F3', 'A3', 'C4'], // F
      ['G3', 'C4', 'E4'], // C
      ['G3', 'B3', 'D4'] // G
    ],
    padAmp: 0.115,
    bass: { roots: ['A2', 'F2', 'C3', 'G2'], amp: 0.2, len: 9, decay: 0.22, fade: 2.2 },
    melody: {
      amp: 0.075,
      len: 1.7,
      decay: 0.85,
      fade: 0.3,
      offsets: [-6.5, -1.8, 2.6, 6.8],
      notes: [
        ['A4', 'C5', 'E5', 'C5'],
        ['F4', 'A4', 'C5', 'A4'],
        ['C5', 'E5', 'G5', 'E5'],
        ['B4', 'D5', 'G5', 'D5']
      ]
    },
    noise: [],
    perc: [],
    lowpass: 5200
  },
  {
    file: 'bgm-02',
    title: 'Énergique douce — 100 BPM, basse pulsée, kick feutré, charley discret',
    seed: 202,
    hop: 9.6,
    chords: [
      ['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['G3', 'C4', 'E4'], ['G3', 'B3', 'D4'],
      ['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['G3', 'C4', 'E4'], ['G3', 'B3', 'D4']
    ],
    padAmp: 0.082,
    bass: { roots: ['A2', 'F2', 'C3', 'G2', 'A2', 'F2', 'C3', 'G2'], amp: 0.24, len: 2.4, decay: 0.5, fade: 0.09 },
    melody: {
      amp: 0.062,
      len: 1.1,
      decay: 1.5,
      fade: 0.06,
      offsets: [-2.6, 1.9],
      notes: [
        ['A4', 'E5'], ['A4', 'C5'], ['C5', 'G5'], ['B4', 'D5'],
        ['A4', 'E5'], ['C5', 'A4'], ['E5', 'G5'], ['D5', 'B4']
      ]
    },
    perc: [
      { start: 0, period: 0.6, freq: 55, amp: 0.3, len: 0.3, decay: 11, fade: 0.004 } // kick 100 BPM
    ],
    noise: [
      { kind: 'charley', start: 0.3, period: 0.6, len: 0.09, decay: 30, fade: 0.005, amp: 0.055, highpass: 6500 }
    ],
    lowpass: 6200
  },
  {
    file: 'bgm-03',
    title: 'Festive — 125 BPM, D/Bm/G/A, kick + clap + shaker, arpège brillant',
    seed: 303,
    hop: 9.6,
    chords: [
      ['D3', 'F3x', 'A3'], ['B2', 'D3', 'F3x'], ['G2', 'B2', 'D3'], ['A2', 'C3x', 'E3'],
      ['D3', 'F3x', 'A3'], ['B2', 'D3', 'F3x'], ['G2', 'B2', 'D3'], ['A2', 'C3x', 'E3']
    ],
    padAmp: 0.075,
    bass: { roots: ['D3', 'B2', 'G2', 'A2', 'D3', 'B2', 'G2', 'A2'], amp: 0.25, len: 1.7, decay: 1.1, fade: 0.05 },
    melody: {
      amp: 0.058,
      len: 0.62,
      decay: 3.4,
      fade: 0.02,
      offsets: [-2.2, 0.4, 2.8],
      notes: [
        ['A4', 'D5', 'F5x'], ['F4x', 'B4', 'D5'], ['B4', 'D5', 'G5'], ['C4x', 'E5', 'A4'],
        ['D5', 'F5x', 'A5'], ['B4', 'D5', 'F5x'], ['G5', 'D5', 'B4'], ['E5', 'C4x', 'A4']
      ]
    },
    perc: [
      { start: 0, period: 1.92, freq: 60, amp: 0.3, len: 0.24, decay: 13, fade: 0.004 },
      { start: 0.96, period: 1.92, freq: 58, amp: 0.26, len: 0.24, decay: 13, fade: 0.004 }
    ],
    noise: [
      { kind: 'clap2', start: 0.48, period: 1.92, len: 0.16, decay: 22, fade: 0.006, amp: 0.075, highpass: 1400 },
      { kind: 'clap4', start: 1.44, period: 1.92, len: 0.16, decay: 22, fade: 0.006, amp: 0.07, highpass: 1400 },
      { kind: 'shaker', start: 0, period: 0.24, len: 0.05, decay: 45, fade: 0.004, amp: 0.032, highpass: 7000 }
    ],
    lowpass: 7000
  }
]

// ---------- construction des unités de rendu ----------
function buildUnits(track) {
  const units = []
  const addTone = (name, terms) => chunk(terms, 3).forEach((t, i) => units.push({ name: `${name}${i || ''}`, kind: 'tone', expr: t.join('+') }))

  // nappe : fenêtres de Hann à recouvrement 50 % (COLA) par accord
  const chords = track.chords.map((tones) => tones.map(normalizeNote))
  const padTerms = []
  chords.forEach((tones, k) => {
    const w = colaWindow(k * track.hop, track.hop)
    tones.forEach((n) => padTerms.push(voice(f(n), w, track.padAmp)))
  })
  addTone('pad', padTerms)

  // basse : une note par créneau d'accord, centrée sur la dominance de l'accord
  const bassTerms = track.bass.roots.map(normalizeNote).map((n, k) => {
    const start = k * track.hop + track.hop / 2
    assertBounded(start, L, track.bass.len, `basse ${n}`)
    return voice(f(n), hitEnv(start, L, track.bass.len, track.bass.decay, track.bass.fade), track.bass.amp)
  })
  addTone('bass', bassTerms)

  // mélodie : notes ponctuelles
  const melTerms = []
  track.melody.notes.forEach((notes, k) => {
    notes.forEach((rawName, j) => {
      const n = normalizeNote(rawName)
      const start = k * track.hop + track.hop / 2 + track.melody.offsets[j]
      assertBounded(start, L, track.melody.len, `mélodie ${n}`)
      melTerms.push(voice(f(n), hitEnv(start, L, track.melody.len, track.melody.decay, track.melody.fade), track.melody.amp))
    })
  })
  addTone('mel', melTerms)

  // percussions tonales (kick)
  const percTerms = track.perc.map((p) => {
    assertBounded(p.start, p.period, p.len, `perc ${p.freq}Hz`)
    return voice(p.freq, hitEnv(p.start, p.period, p.len, p.decay, p.fade), p.amp)
  })
  if (percTerms.length) addTone('perc', percTerms)

  // bruit (charley / clap / shaker) : porte dynamique, silence assuré aux bornes
  const noiseGroups = new Map()
  track.noise.forEach((n) => {
    assertBounded(n.start, n.period, n.len, `bruit ${n.kind}`)
    const key = `n${n.highpass}`
    if (!noiseGroups.has(key)) noiseGroups.set(key, { highpass: n.highpass, gates: [] })
    noiseGroups.get(key).gates.push(`${num(n.amp, 4)}*${hitEnv(n.start, n.period, n.len, n.decay, n.fade)}`)
  })
  let ni = 0
  for (const g of noiseGroups.values()) {
    units.push({
      name: `noise${ni++}`,
      kind: 'noise',
      highpass: g.highpass,
      expr: g.gates.join('+')
    })
  }
  return units
}

// ---------- commandes ffmpeg ----------
const commands = []
const record = (argv) => {
  commands.push(FFMPEG + ' ' + argv.map((a) => (/^[\w./:=,+-]+$/.test(a) ? a : `"${a.replace(/"/g, '\\"')}"`)).join(' '))
  return [FFMPEG, ...argv]
}

function unitRender(track, unit, { sr, duration, out }) {
  const graph = unit.kind === 'noise'
    ? `anoisesrc=color=pink:r=${sr}:a=0.9:d=${duration}:seed=${track.seed}[raw];[raw]highpass=f=${unit.highpass},volume=volume='${unit.expr}':eval=frame[o]`
    : `aevalsrc=exprs='${unit.expr}':s=${sr}:d=${duration}:c=mono[o]`
  return record(['-hide_banner', '-v', 'error', '-filter_complex', graph, '-map', '[o]', '-f', 'f32le', '-ar', String(sr), '-ac', '1', out, '-y'])
}

function mixRender(track, unitFiles, out, startAt) {
  const inputs = unitFiles.flatMap((p) => ['-f', 'f32le', '-ar', String(SR), '-ac', '1', '-i', p])
  const labels = unitFiles.map((_, i) => `[${i}]`).join('')
  const graph = [
    `${labels}amix=inputs=${unitFiles.length}:normalize=0[mix]`,
    `[mix]lowpass=f=${track.lowpass},aecho=0.65:0.5:150|390:0.26|0.13[room]`,
    `[room]asplit=2[l][r]`,
    `[r]adelay=13[rd]`,
    `[l][rd]amerge=inputs=2,aformat=sample_fmts=fltp:channel_layouts=stereo[out]`
  ].join(';')
  // -ss <startAt> : on jette le pré-roulage des filtres, le segment conservé est
  // en régime permanent (donc raccordable sur la boucle).
  return record(['-hide_banner', '-v', 'error', ...inputs, '-filter_complex', graph, '-map', '[out]', '-ss', String(startAt), '-t', String(L), '-f', 'f32le', '-ar', String(SR), '-ac', '2', out, '-y'])
}

function encodeRender(gainDb, rawPath, mp3Path) {
  return record(['-hide_banner', '-v', 'error', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', rawPath, '-t', String(L), '-af', `volume=${gainDb}dB`, '-c:a', 'libmp3lame', '-b:a', MP3_BITRATE, '-ar', String(SR), '-ac', '2', mp3Path, '-y'])
}

// ---------- mesures ----------
async function runPool(jobs) {
  const results = new Array(jobs.length)
  let next = 0
  const workers = Array.from({ length: Math.min(CPU, jobs.length) }, async () => {
    while (next < jobs.length) {
      const i = next++
      results[i] = await jobs[i]()
    }
  })
  await Promise.all(workers)
  return results
}
async function levelStats(rawPath, channels) {
  const { stderr } = await run(FFMPEG, ['-hide_banner', '-v', 'info', '-f', 'f32le', '-ar', String(SR), '-ac', String(channels), '-i', rawPath, '-af', 'volumedetect', '-f', 'null', '-'])
  const max = /max_volume: (-?[\d.]+) dB/.exec(stderr)
  const mean = /mean_volume: (-?[\d.]+) dB/.exec(stderr)
  if (!max || !mean) throw new Error(`volumedetect incomplet pour ${rawPath}`)
  return { maxDb: Number(max[1]), meanDb: Number(mean[1]) }
}
const toDb = (v) => (v <= 0 ? -Infinity : 20 * Math.log10(v))

// périodicité : compare les deux moitiés d'un rendu de 2*L (canal par canal)
function periodicityCheck(rawPath, channels) {
  const buf = readFileSync(rawPath)
  const all = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4))
  const frames = Math.floor(all.length / channels)
  const half = Math.floor(frames / 2)
  let max = 0
  let sum = 0
  for (let i = 0; i < half; i++) {
    for (let c = 0; c < channels; c++) {
      const d = Math.abs(all[i * channels + c] - all[(i + half) * channels + c])
      if (d > max) max = d
      sum += d * d
    }
  }
  const n = half * channels
  return { maxDiff: max, maxDiffDb: toDb(max), rmsDiffDb: toDb(Math.sqrt(sum / n)) }
}
// Clique ou non au raccord : on compare le saut de raccord à la distribution des
// pentes échantillon-à-échantillon du morceau lui-même. Si le saut est dans la
// plage normale du morceau, la boucle est indiscernable d'un instant quelconque.
function seamClickCheck(rawPath, channels = 2) {
  const buf = readFileSync(rawPath)
  const all = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4))
  const frames = Math.floor(all.length / channels)
  const deltas = new Float64Array(frames - 1)
  let sum = 0
  for (let i = 1; i < frames; i++) {
    const d = Math.abs(all[i * channels] - all[(i - 1) * channels])
    deltas[i - 1] = d
    sum += d
  }
  const sorted = deltas.sort()
  const meanDelta = sum / deltas.length
  const p999 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.999))]
  const maxDelta = sorted[sorted.length - 1]
  const seamDelta = Math.abs(all[0] - all[(frames - 1) * channels])
  const rank = sorted.findIndex((v) => v >= seamDelta)
  return {
    seamDelta,
    seamDeltaDb: toDb(seamDelta),
    meanDelta,
    meanDeltaDb: toDb(meanDelta),
    p999Db: toDb(p999),
    maxDeltaDb: toDb(maxDelta),
    seamPercentile: rank === -1 ? 100 : Number(((rank / sorted.length) * 100).toFixed(3)),
    belowInteriorMax: seamDelta <= maxDelta
  }
}

// Compare deux segments bruts de même longueur (preuve de périodicité bout-en-bout)
function compareRaw(aPath, bPath, channels) {
  const a = new Float32Array(readFileSync(aPath).buffer)
  const b = new Float32Array(readFileSync(bPath).buffer)
  const n = Math.min(a.length, b.length)
  let max = 0
  let sum = 0
  for (let i = 0; i < n; i++) {
    const d = Math.abs(a[i] - b[i])
    if (d > max) max = d
    sum += d * d
  }
  return { maxDiffDb: toDb(max), rmsDiffDb: toDb(Math.sqrt(sum / n)) }
}

// ---------- exécution ----------
const only = process.argv[2]
mkdirSync(OUT_MP3, { recursive: true })
mkdirSync(OUT_BUILD, { recursive: true })
mkdirSync(FG_DIR, { recursive: true })

const report = []
for (const track of TRACKS) {
  if (only && !track.file.startsWith(only)) continue
  const units = buildUnits(track)
  const toneEntries = units.map((u, i) => ({ u, i })).filter((e) => e.u.kind === 'tone')
  const noiseEntries = units.map((u, i) => ({ u, i })).filter((e) => e.u.kind === 'noise')
  console.log(`\n=== ${track.file} — ${track.title}`)
  console.log(`  ${units.length} unités de rendu (${toneEntries.length} tonales, ${noiseEntries.length} bruitées)`)

  // 1. rendu des unités (2*L + pré-roulage pour permettre les deux prises de mix)
  const longDur = 2 * L + WARMUP
  const jobs = []
  const unitFiles = units.map((u, i) => join(OUT_BUILD, `${track.file}.u${i}.f32`))
  units.forEach((u, i) => {
    jobs.push(async () => {
      const argv = unitRender(track, u, { sr: SR, duration: longDur, out: unitFiles[i] })
      await run(argv[0], argv.slice(1))
    })
    if (u.kind === 'tone') {
      const checkFile = join(OUT_BUILD, `${track.file}.u${i}.check.f32`)
      jobs.push(async () => {
        const argv = unitRender(track, u, { sr: SR_CHECK, duration: 2 * L, out: checkFile })
        await run(argv[0], argv.slice(1))
      })
    }
  })
  await runPool(jobs)

  // 2. preuve A — périodicité unité par unité (chaque créneau/lot de termes)
  const checks = toneEntries.map(({ u, i }) => {
    const r = periodicityCheck(join(OUT_BUILD, `${track.file}.u${i}.check.f32`), 1)
    return { unit: u.name, maxDiffDb: Number(r.maxDiffDb.toFixed(1)), rmsDiffDb: Number(r.rmsDiffDb.toFixed(1)) }
  })
  const worstUnit = checks.reduce((a, b) => (b.rmsDiffDb > a.rmsDiffDb ? b : a), checks[0])
  const worstUnitMax = checks.reduce((a, b) => (b.maxDiffDb > a.maxDiffDb ? b : a), checks[0])
  console.log(`  preuve A — périodicité unitaire (2×L à ${SR_CHECK} Hz) : pire écart RMS ${worstUnit.rmsDiffDb} dB (${worstUnit.unit})`)

  // 3. preuve B — chaîne complète (unités tonales + filtres) : deux prises de L
  //    secondes espacées exactement d'une boucle doivent être identiques.
  const toneFiles = toneEntries.map(({ i }) => unitFiles[i])
  const takeA = join(OUT_BUILD, `${track.file}.toneA.f32`)
  const takeB = join(OUT_BUILD, `${track.file}.toneB.f32`)
  const argvA = mixRender(track, toneFiles, takeA, WARMUP)
  const argvB = mixRender(track, toneFiles, takeB, WARMUP + L)
  await run(argvA[0], argvA.slice(1))
  await run(argvB[0], argvB.slice(1))
  const chain = compareRaw(takeA, takeB, 2)
  console.log(`  preuve B — chaîne mélodie+accords+filtres, 2 prises espacées de L : écart max ${chain.maxDiffDb.toFixed(1)} dB, RMS ${chain.rmsDiffDb.toFixed(1)} dB`)

  // 4. mix livré : unités tonales + percussions bruitées, pseudo-stéréo
  const fullRaw = join(OUT_BUILD, `${track.file}.mix.f32`)
  const mixArgv = mixRender(track, unitFiles, fullRaw, WARMUP)
  await run(mixArgv[0], mixArgv.slice(1))

  // 5. normalisation de loudness (gain statique : préserve la périodicité, contrairement à loudnorm)
  const level = await levelStats(fullRaw, 2)
  const gain = Number(Math.min(TARGET_MEAN_DB - level.meanDb, PEAK_CEILING_DB - level.maxDb).toFixed(2))
  const mp3 = join(OUT_MP3, `${track.file}.mp3`)
  const encArgv = encodeRender(gain, fullRaw, mp3)
  await run(encArgv[0], encArgv.slice(1))

  // 6. test de clic au point de bouclage du mix livré
  const click = seamClickCheck(fullRaw, 2)
  const size = statSync(mp3).size
  report.push({
    file: `public/audio/${track.file}.mp3`,
    title: track.title,
    loopSeconds: L,
    units: units.length,
    tonalUnits: toneEntries.length,
    noiseUnits: noiseEntries.length,
    proofA_unitRmsDb: worstUnit.rmsDiffDb,
    proofA_unitMaxDb: worstUnitMax.maxDiffDb,
    proofB_chainMaxDb: Number(chain.maxDiffDb.toFixed(1)),
    proofB_chainRmsDb: Number(chain.rmsDiffDb.toFixed(1)),
    mixMeanDbFs: level.meanDb,
    mixPeakDbFs: level.maxDb,
    gainAppliedDb: gain,
    seamDeltaDb: Number(click.seamDeltaDb?.toFixed ? click.seamDeltaDb.toFixed(1) : click.seamDeltaDb),
    seamPercentileInTrack: click.seamPercentile,
    seamBelowInteriorMax: click.belowInteriorMax,
    sizeBytes: size,
    sizeKb: Math.round(size / 1024),
    filtergraph: `scripts/bgm/${track.file}.filtergraph`
  })
  console.log(`  mix : RMS ${level.meanDb} dBFS / pic ${level.maxDb} dBFS -> gain ${gain} dB`)
  console.log(`  raccord : saut ${click.seamDeltaDb.toFixed(1)} dB (${click.seamPercentile}ᵉ centile des pentes internes, max interne ${click.maxDeltaDb.toFixed(1)} dB) ; mp3 ${Math.round(size / 1024)} Ko`)
}

// Les graphes complets (unités + mix) sont conservés pour audit
for (const track of TRACKS) {
  if (only && !track.file.startsWith(only)) continue
  const units = buildUnits(track).map((u) => `### ${u.name} (${u.kind})\n${u.expr}`).join('\n\n')
  writeFileSync(join(FG_DIR, `${track.file}.filtergraph`), `# ${track.file} — ${track.title}\n# Boucle L = ${L} s, ${SR} Hz, ${MP3_BITRATE}\n\n${units}\n`, 'utf8')
}
writeFileSync(join(FG_DIR, 'COMMANDES.md'), `# Commandes ffmpeg exactes — génération des musiques de fond\n\nGénérées par \`node scripts/generate-bgm.mjs\` (${new Date().toISOString()}).\n\nToutes les expressions de synthèse (source lavfi \`aevalsrc\` / \`anoisesrc\`) sont dans\nles fichiers \`scripts/bgm/bgm-0X.filtergraph\`.\n\n\`\`\`bash\n${commands.join('\n')}\n\`\`\`\n`, 'utf8')

const reportPath = join(OUT_BUILD, 'rapport-generation.json')
writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8')
console.log(`\nRapport : ${reportPath}`)
