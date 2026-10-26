<script setup lang="ts">
import { computed } from 'vue'
import { SCENE_H, SCENE_W } from '../../utils/games/scene'

/**
 * Salle de fête dessinée en SVG (illustration originale).
 * - `diffs` : ids des différences à appliquer (0 à 7), voir utils/games/scene.ts
 * - `viewBox` : permet de n'afficher qu'un morceau de la scène (utilisé par le taquin)
 * - `marks` : cercles de repérage dessinés par-dessus (jeu des différences)
 */
const props = withDefaults(
  defineProps<{
    diffs?: number[]
    viewBox?: string
    marks?: { cx: number; cy: number; r: number }[]
  }>(),
  { diffs: () => [], viewBox: '0 0 ' + SCENE_W + ' ' + SCENE_H, marks: () => [] },
)

const has = (id: number) => props.diffs.includes(id)

const FLAG_COLORS = ['#f472b6', '#facc15', '#34d399', '#60a5fa', '#fb923c', '#c084fc']
const flags = computed(() =>
  Array.from({ length: 8 }, (_, i) => {
    const x = 30 + i * 48
    const t = x / 400
    const y = 18 + 44 * t * (1 - t)
    const color = i === 2 && has(0) ? '#ffffff' : FLAG_COLORS[i % FLAG_COLORS.length]!
    return { points: `${x - 14},${y} ${x + 14},${y} ${x},${y + 30}`, color }
  }),
)
</script>

<template>
  <svg :viewBox="viewBox" class="block h-full w-full" role="img" aria-label="Une salle de fête avec un gâteau, des ballons et un cadeau">
    <!-- murs et sol -->
    <rect width="400" height="300" fill="#ddd6fe" />
    <rect y="232" width="400" height="68" fill="#a78bfa" />
    <rect y="228" width="400" height="6" fill="#8b5cf6" />
    <!-- guirlande -->
    <path d="M0 18 Q200 62 400 18" stroke="#6d28d9" stroke-width="2" fill="none" />
    <polygon v-for="(f, i) in flags" :key="i" :points="f.points" :fill="f.color" stroke="#6d28d9" stroke-width="1" />
    <!-- fenêtre -->
    <rect x="24" y="70" width="84" height="100" rx="3" fill="#f5f3ff" stroke="#6d28d9" stroke-width="3" />
    <rect x="30" y="76" width="72" height="88" fill="#1e1b4b" />
    <circle cx="82" cy="92" r="1.6" fill="#fff" />
    <circle cx="88" cy="128" r="1.6" fill="#fff" />
    <circle cx="46" cy="142" r="1.6" fill="#fff" />
    <g v-if="!has(1)">
      <circle cx="52" cy="100" r="12" fill="#fef9c3" />
      <circle cx="57" cy="96" r="11" fill="#1e1b4b" />
    </g>
    <line x1="66" y1="76" x2="66" y2="164" stroke="#f5f3ff" stroke-width="3" />
    <line x1="30" y1="120" x2="102" y2="120" stroke="#f5f3ff" stroke-width="3" />
    <!-- cadeau -->
    <rect x="64" y="196" width="44" height="38" fill="#f43f5e" />
    <rect x="60" y="188" width="52" height="12" rx="2" fill="#e11d48" />
    <rect x="82" y="188" width="8" height="46" :fill="has(5) ? '#34d399' : '#fde047'" />
    <circle cx="80" cy="183" r="6" fill="none" :stroke="has(5) ? '#34d399' : '#fde047'" stroke-width="3" />
    <circle cx="92" cy="183" r="6" fill="none" :stroke="has(5) ? '#34d399' : '#fde047'" stroke-width="3" />
    <!-- table -->
    <rect x="120" y="206" width="190" height="12" rx="3" fill="#7c3aed" />
    <rect x="132" y="218" width="10" height="16" fill="#6d28d9" />
    <rect x="288" y="218" width="10" height="16" fill="#6d28d9" />
    <!-- assiette et gâteau -->
    <ellipse cx="205" cy="206" rx="52" ry="6" :fill="has(3) ? '#fde68a' : '#ffffff'" />
    <rect x="172" y="176" width="66" height="30" rx="4" fill="#f9a8d4" />
    <rect x="172" y="176" width="66" height="8" rx="4" fill="#ffffff" />
    <rect x="186" y="152" width="38" height="24" rx="3" fill="#fbcfe8" />
    <rect x="186" y="152" width="38" height="7" rx="3" fill="#ffffff" />
    <rect x="193" y="134" width="4" height="18" fill="#60a5fa" />
    <ellipse cx="195" cy="130" rx="3" ry="5" fill="#fb923c" />
    <g v-if="!has(2)">
      <rect x="203" y="134" width="4" height="18" fill="#facc15" />
      <ellipse cx="205" cy="130" rx="3" ry="5" fill="#fb923c" />
    </g>
    <rect x="213" y="134" width="4" height="18" fill="#34d399" />
    <ellipse cx="215" cy="130" rx="3" ry="5" fill="#fb923c" />
    <!-- ordinateur -->
    <rect x="262" y="198" width="48" height="8" rx="2" fill="#475569" />
    <rect x="267" y="166" width="38" height="32" rx="3" fill="#1e1b4b" stroke="#475569" stroke-width="2" />
    <text v-if="!has(6)" x="286" y="187" text-anchor="middle" font-size="12" font-family="monospace" fill="#34d399">&lt;/&gt;</text>
    <path v-else transform="translate(286 183)" d="M0 7 C-12 -3 -6 -11 0 -4 C6 -11 12 -3 0 7Z" fill="#f472b6" />
    <!-- ballons -->
    <line x1="348" y1="118" x2="332" y2="236" stroke="#6d28d9" stroke-width="1" />
    <line x1="378" y1="141" x2="332" y2="236" stroke="#6d28d9" stroke-width="1" />
    <line x1="322" y1="143" x2="332" y2="236" stroke="#6d28d9" stroke-width="1" />
    <circle cx="332" cy="238" r="5" fill="#6d28d9" />
    <ellipse cx="348" cy="92" rx="20" ry="26" fill="#f472b6" />
    <ellipse cx="378" cy="118" rx="18" ry="23" :fill="has(4) ? '#fde047' : '#8b5cf6'" />
    <ellipse cx="322" cy="120" rx="18" ry="23" fill="#60a5fa" />
    <ellipse cx="341" cy="82" rx="4" ry="7" fill="#fff" fill-opacity="0.45" />
    <!-- plante -->
    <polygon points="350,236 382,236 378,264 354,264" fill="#fb923c" />
    <ellipse cx="366" cy="212" rx="6" ry="18" fill="#16a34a" />
    <ellipse cx="352" cy="219" rx="6" ry="16" transform="rotate(-30 352 219)" fill="#22c55e" />
    <ellipse v-if="!has(7)" cx="381" cy="217" rx="6" ry="16" transform="rotate(30 381 217)" fill="#22c55e" />
    <!-- repères (jeu des différences) -->
    <circle v-for="(m, i) in marks" :key="i" :cx="m.cx" :cy="m.cy" :r="m.r + 4" fill="none" stroke="#ef4444" stroke-width="3" />
  </svg>
</template>
