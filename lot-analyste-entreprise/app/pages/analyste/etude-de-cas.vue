<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, Check, ChartLine, Coins, Eye, Funnel, Lightbulb, MessageSquareWarning, Package, RotateCcw, ShoppingCart, Store, TrendingUp, X } from '@lucide/vue'
import GameButton from '../../components/analyste/GameButton.vue'
import StackedBarChart from '../../components/analyste/charts/StackedBarChart.vue'
import BarChart from '../../components/analyste/charts/BarChart.vue'
import FunnelChart from '../../components/analyste/charts/FunnelChart.vue'
import { CHANNELS, COMPLAINTS, DECISIONS, FUNNEL, MONTHS, channelTotals, complaintCumulative, funnelRates, growthPct, productStats, totalRevenue } from '../../utils/analyste/cas'
import { formatEuro, formatPercent } from '../../utils/analyste/format'

useHead({ title: 'Étude de cas : Atelier Cannelle' })

type Tab = 'apercu' | 'produits' | 'clients'
const tab = ref<Tab>('apercu')
const tabs: { key: Tab; label: string; icon: typeof Eye }[] = [
  { key: 'apercu', label: 'Vue d’ensemble', icon: Eye },
  { key: 'produits', label: 'Produits', icon: Package },
  { key: 'clients', label: 'Clients et réclamations', icon: ShoppingCart },
]

const CHANNEL_COLORS: Record<string, string> = { site: 'var(--primary-color)', boutique: 'var(--accent-color)', marche: 'var(--theme-heading)' }
const channelIcon = { site: ShoppingCart, boutique: Store, marche: Package }
const active = ref<Record<string, boolean>>({ site: true, boutique: true, marche: true })
const stacks = computed(() => CHANNELS.filter((c) => active.value[c.key]).map((c) => ({ name: c.label, color: CHANNEL_COLORS[c.key]!, values: c.values })))
const shown = computed(() => stacks.value.reduce((s, st) => s + st.values.reduce((a, b) => a + b, 0), 0))

const total = totalRevenue()
const channels = channelTotals()
const products = productStats()
const rates = funnelRates()
const worst = rates.indexOf(rates.slice().sort((a, b) => a.rate - b.rate)[0]!)
const overall = (100 * FUNNEL[FUNNEL.length - 1]!.value) / FUNNEL[0]!.value
const complaints = complaintCumulative()
const totalComplaints = COMPLAINTS.reduce((s, c) => s + c.count, 0)
const siteGrowth = growthPct(CHANNELS[0]!.values)

const answers = ref<Record<string, string | undefined>>({})
const submitted = ref<Record<string, boolean>>({})
const done = computed(() => DECISIONS.every((d) => submitted.value[d.id]))
const goodCount = computed(() => DECISIONS.filter((d) => submitted.value[d.id] && answers.value[d.id] === d.answer).length)

function submit(id: string) {
  if (answers.value[id]) submitted.value = { ...submitted.value, [id]: true }
}
function restart() {
  answers.value = {}
  submitted.value = {}
  tab.value = 'apercu'
}
</script>

<template>
  <main class="theme-page analyst-page min-h-dvh mx-auto w-full max-w-5xl px-4 py-8 text-slate-100">
    <header class="mb-6">
      <h1 class="mb-2 text-3xl font-extrabold tracking-tight text-white">Étude de cas : Atelier Cannelle</h1>
      <p class="max-w-3xl text-slate-300">
        Atelier Cannelle est une pâtisserie qui vend ses gâteaux sur son site, dans sa boutique et sur un marché. L’entreprise (inventée) te demande de regarder ses chiffres de l’année et de l’aider à décider où concentrer ses efforts.
        <strong class="text-white">Ta mission :</strong> explore les trois onglets, puis réponds aux trois questions de décision en bas de page.
      </p>
    </header>

    <ul class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Chiffres clés">
      <li class="rounded-2xl border border-slate-700 bg-slate-900/70 p-4"><Coins class="mb-1 h-5 w-5 text-amber-300" aria-hidden="true" /><p class="text-xs text-slate-400">Chiffre d’affaires de l’année</p><p class="text-xl font-bold text-white">{{ formatEuro(total) }}</p></li>
      <li class="rounded-2xl border border-slate-700 bg-slate-900/70 p-4"><TrendingUp class="mb-1 h-5 w-5 text-teal-300" aria-hidden="true" /><p class="text-xs text-slate-400">Croissance du site (janvier à décembre)</p><p class="text-xl font-bold text-white">+{{ formatPercent(siteGrowth, 0) }}</p></li>
      <li class="rounded-2xl border border-slate-700 bg-slate-900/70 p-4"><Funnel class="mb-1 h-5 w-5 text-sky-300" aria-hidden="true" /><p class="text-xs text-slate-400">Conversion du site (visiteurs vers commandes)</p><p class="text-xl font-bold text-white">{{ formatPercent(overall) }}</p></li>
      <li class="rounded-2xl border border-slate-700 bg-slate-900/70 p-4"><MessageSquareWarning class="mb-1 h-5 w-5 text-rose-300" aria-hidden="true" /><p class="text-xs text-slate-400">Réclamations de l’année</p><p class="text-xl font-bold text-white">{{ totalComplaints }}</p></li>
    </ul>

    <div class="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Sections de l’étude">
      <button v-for="t in tabs" :key="t.key" type="button" role="tab" :aria-selected="tab === t.key" class="inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition active:scale-95" :class="tab === t.key ? 'border-teal-300 bg-teal-400/20 text-white' : 'border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800'" @click="tab = t.key"><component :is="t.icon" class="h-4 w-4" aria-hidden="true" />{{ t.label }}</button>
    </div>

    <section v-if="tab === 'apercu'" class="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 sm:p-6" aria-labelledby="t-apercu">
      <h2 id="t-apercu" class="mb-1 text-xl font-bold text-white">Chiffre d’affaires mensuel par canal</h2>
      <p class="mb-3 text-sm text-slate-300">Active ou désactive les canaux pour comparer leur évolution. Total affiché : <strong class="text-white">{{ formatEuro(shown) }}</strong>.</p>
      <div class="mb-3 flex flex-wrap gap-2">
        <button v-for="c in CHANNELS" :key="c.key" type="button" class="inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm transition active:scale-95" :style="{ borderColor: active[c.key] ? 'var(--primary-color)' : 'var(--border-color)', backgroundColor: active[c.key] ? 'var(--theme-soft-primary)' : 'transparent', color: active[c.key] ? 'var(--theme-heading)' : 'var(--theme-muted-text)' }" :aria-pressed="active[c.key]" @click="active[c.key] = !active[c.key]">
          <span class="inline-block h-3 w-3 rounded-sm" :style="{ backgroundColor: active[c.key] ? CHANNEL_COLORS[c.key] : 'var(--theme-muted-text)' }" aria-hidden="true" /><component :is="channelIcon[c.key]" class="h-4 w-4" aria-hidden="true" />{{ c.label }}
        </button>
      </div>
      <StackedBarChart v-if="stacks.length" :labels="MONTHS" :stacks="stacks" :height="260" label="Chiffre d’affaires mensuel par canal de vente sur douze mois" />
      <p v-else class="py-10 text-center text-slate-400">Active au moins un canal pour afficher le graphique.</p>
      <h3 class="mb-2 mt-4 font-semibold text-white">Ce que montrent les chiffres</h3>
      <ul class="list-disc space-y-1 pl-5 text-sm text-slate-200">
        <li v-for="c in channels" :key="c.key">{{ c.label }} : {{ formatEuro(c.total) }}, soit {{ formatPercent((100 * c.total) / total, 0) }} du total.</li>
        <li>Le site web a été multiplié par {{ (CHANNELS[0]!.values[11]! / CHANNELS[0]!.values[0]!).toFixed(1).replace('.', ',') }} entre janvier et décembre, avec un pic de fin d’année.</li>
        <li>La boutique reste stable toute l’année ; le marché est saisonnier et culmine en été.</li>
      </ul>
    </section>

    <section v-else-if="tab === 'produits'" class="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 sm:p-6" aria-labelledby="t-produits">
      <h2 id="t-produits" class="mb-1 text-xl font-bold text-white">Profit brut par produit</h2>
      <p class="mb-3 text-sm text-slate-300">Profit brut = chiffre d’affaires du produit × sa marge brute. Le volume et la marge comptent tous les deux.</p>
      <BarChart :labels="products.map((p) => p.name)" :values="products.map((p) => Math.round(p.grossProfit))" :highlight="[products.indexOf(products.slice().sort((a, b) => b.grossProfit - a.grossProfit)[0]!)]" :height="250" label="Profit brut annuel de chaque produit, en euros" />
      <div class="mt-3 overflow-x-auto">
        <table class="w-full min-w-[30rem] text-sm">
          <caption class="sr-only">Détail par produit</caption>
          <thead class="text-left text-xs uppercase text-slate-400"><tr><th scope="col" class="py-2">Produit</th><th scope="col">Chiffre d’affaires</th><th scope="col">Marge brute</th><th scope="col">Profit brut</th><th scope="col">Part du profit</th></tr></thead>
          <tbody>
            <tr v-for="p in products" :key="p.name" class="border-t border-slate-800"><th scope="row" class="py-2 text-left font-medium text-white">{{ p.name }}</th><td>{{ formatEuro(p.revenue) }}</td><td>{{ formatPercent(p.margin * 100, 0) }}</td><td>{{ formatEuro(p.grossProfit) }}</td><td>{{ formatPercent(p.profitShare) }}</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-else class="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 sm:p-6" aria-labelledby="t-clients">
      <h2 id="t-clients" class="mb-1 text-xl font-bold text-white">Le parcours d’achat sur le site (dernier trimestre)</h2>
      <p class="mb-3 text-sm text-slate-300">L’étape qui perd le plus de monde en proportion est surlignée : « {{ rates[worst]!.from }} » vers « {{ rates[worst]!.to }} » ({{ formatPercent(rates[worst]!.rate) }} seulement).</p>
      <FunnelChart :steps="FUNNEL" :highlight="worst" />
      <h2 class="mb-1 mt-8 text-xl font-bold text-white">Les réclamations (Pareto)</h2>
      <p class="mb-3 text-sm text-slate-300">Les barres montrent le nombre de réclamations par cause ; la courbe orange, le cumul. Le trait rouge marque 80 %.</p>
      <BarChart :labels="COMPLAINTS.map((c) => c.cause)" :values="COMPLAINTS.map((c) => c.count)" :cumulative="complaints.map((c) => c.cumulativePct)" :threshold="80" :highlight="[0, 1, 2]" :height="280" label="Diagramme de Pareto des réclamations par cause" />
    </section>

    <section class="mt-10" aria-labelledby="decisions">
      <h2 id="decisions" class="mb-1 flex items-center gap-2 text-2xl font-bold text-white"><Lightbulb class="h-6 w-6 text-amber-300" aria-hidden="true" />À toi de recommander</h2>
      <p class="mb-4 text-slate-300">Trois décisions à prendre, avec les chiffres que tu viens de voir. Chaque réponse est expliquée avec les calculs.</p>
      <ol class="space-y-5">
        <li v-for="(d, n) in DECISIONS" :key="d.id" class="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 sm:p-6">
          <fieldset :disabled="submitted[d.id]">
            <legend class="mb-1 text-sm font-semibold text-teal-300">Décision {{ n + 1 }} · {{ d.title }}</legend>
            <p class="mb-3 text-lg text-white">{{ d.question }}</p>
            <div class="space-y-2">
              <label v-for="o in d.options" :key="o.key" class="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition" :class="submitted[d.id] ? (o.key === d.answer ? 'border-emerald-300 bg-emerald-500/15' : answers[d.id] === o.key ? 'border-rose-300 bg-rose-500/15' : 'border-slate-700 opacity-60') : answers[d.id] === o.key ? 'border-teal-300 bg-teal-500/15' : 'border-slate-600 hover:bg-slate-800'">
                <input v-model="answers[d.id]" type="radio" :name="d.id" :value="o.key" class="h-4 w-4 accent-teal-400" />
                <span class="flex-1">{{ o.label }}</span>
                <Check v-if="submitted[d.id] && o.key === d.answer" class="h-5 w-5 text-emerald-300" aria-hidden="true" /><X v-else-if="submitted[d.id] && answers[d.id] === o.key" class="h-5 w-5 text-rose-300" aria-hidden="true" />
              </label>
            </div>
          </fieldset>
          <div v-if="!submitted[d.id]" class="mt-3"><GameButton :disabled="!answers[d.id]" @click="submit(d.id)"><Check class="h-4 w-4" aria-hidden="true" /> Valider ma recommandation</GameButton></div>
          <p v-else class="mt-3 rounded-xl bg-slate-800/80 p-3 text-sm text-slate-200" role="status" aria-live="polite"><strong :class="answers[d.id] === d.answer ? 'text-emerald-300' : 'text-rose-300'">{{ answers[d.id] === d.answer ? 'Bonne recommandation. ' : 'Pas la meilleure option. ' }}</strong>{{ d.explain() }}</p>
        </li>
      </ol>

      <div v-if="done" class="mt-6 rounded-2xl border border-teal-400/40 bg-teal-500/10 p-5 sm:p-6" role="status" aria-live="polite">
        <h3 class="mb-1 flex items-center gap-2 text-xl font-bold text-white"><ChartLine class="h-6 w-6 text-teal-300" aria-hidden="true" />Note de synthèse</h3>
        <p class="mb-3 text-slate-200">Tu as retenu la meilleure option pour <strong class="text-white">{{ goodCount }} décision(s) sur {{ DECISIONS.length }}</strong>.</p>
        <ul class="mb-4 space-y-1 text-sm text-slate-200">
          <li v-for="d in DECISIONS" :key="d.id" class="flex items-start gap-2">
            <Check v-if="answers[d.id] === d.answer" class="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" /><X v-else class="mt-0.5 h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />
            <span><strong>{{ d.title }}</strong> : {{ d.options.find((o) => o.key === answers[d.id])?.label }}</span>
          </li>
        </ul>
        <div class="flex flex-wrap gap-2">
          <GameButton variant="ghost" @click="restart"><RotateCcw class="h-4 w-4" aria-hidden="true" /> Refaire l’étude</GameButton>
          <NuxtLink to="/analyste/jeux" class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-sky-500 px-5 font-semibold text-slate-950">Continuer avec les jeux <ArrowRight class="h-4 w-4" aria-hidden="true" /></NuxtLink>
        </div>
      </div>
    </section>
  </main>
</template>
