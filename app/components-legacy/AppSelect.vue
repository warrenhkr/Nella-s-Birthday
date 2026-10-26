<script lang="ts">
// Compteur au niveau MODULE (et non dans <script setup>, qui est réexécuté
// à chaque instance) : garantit un id unique pour lier <label> et <select>.
let compteurSelect = 0
</script>

<script setup lang="ts">
// ============================================================
// AppSelect — LE sélecteur unique du site.
//
// Remplace les 28 <select> natifs et les <USelect> dispersés qui
// avaient chacun leur style. Un seul endroit à faire évoluer.
//
// Compatible avec les deux usages existants :
//   <AppSelect v-model="valeur" :options="[...]" />
//   <AppSelect :model-value="valeur" :options="[...]" @change="..." />
//
// Le rendu reste un <select> natif : sur mobile, le téléphone ouvre son
// propre sélecteur (bien meilleure expérience qu'une liste maison), et le
// clavier/accessibilité fonctionnent nativement.
//
// Thème : uniquement les variables CSS du site (var(--…)), donc les 4
// combinaisons sombre/clair × persona/cyberpunk sont respectées.
// ============================================================

type OptionBrute =
  | string
  | number
  | { value: string | number, label: string, disabled?: boolean }

const props = withDefaults(defineProps<{
  modelValue?: string | number | null
  options?: OptionBrute[]
  label?: string
  ariaLabel?: string
  placeholder?: string
  icon?: string
  disabled?: boolean
  size?: 'sm' | 'md'
  variant?: 'field' | 'filter'
  id?: string
  /** Champ obligatoire : astérisque après le libellé + `aria-required` sur le select. */
  required?: boolean
}>(), {
  options: () => [],
  disabled: false,
  size: 'md',
  variant: 'field',
  required: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
}>()

// Identifiant stable pour lier <label> et <select> (accessibilité).
const idChamp = computed(() => props.id || `app-select-${++compteurSelect}`)

const optionsNormalisees = computed(() =>
  props.options.map(option =>
    typeof option === 'object'
      ? option
      : { value: option, label: String(option) }
  )
)

function onChange(evenement: Event) {
  const valeur = (evenement.target as HTMLSelectElement).value
  emit('update:modelValue', valeur)
  emit('change', valeur)
}
</script>

<template>
  <div class="app-select" :class="[`app-select--${variant}`, `app-select--${size}`]">
    <label v-if="label" :for="idChamp" class="app-select__label">
      {{ label }}<span
        v-if="required"
        class="app-select__required"
        aria-hidden="true"
      >*</span>
    </label>

    <div class="app-select__wrap">
      <UIcon
        v-if="icon"
        :name="icon"
        class="app-select__icon"
        aria-hidden="true"
      />

      <select
        :id="idChamp"
        :value="modelValue ?? ''"
        :disabled="disabled"
        :required="required"
        :aria-required="required || undefined"
        :aria-label="ariaLabel || label || undefined"
        class="app-select__native"
        :class="{ 'app-select__native--icon': icon }"
        @change="onChange"
      >
        <option v-if="placeholder" value="" disabled>
          {{ placeholder }}
        </option>
        <option
          v-for="option in optionsNormalisees"
          :key="String(option.value)"
          :value="option.value"
          :disabled="option.disabled"
        >
          {{ option.label }}
        </option>
        <!-- Permet d'écrire ses <option> à la main quand la liste est dynamique. -->
        <slot />
      </select>

      <UIcon
        name="i-lucide-chevron-down"
        class="app-select__chevron"
        aria-hidden="true"
      />
    </div>
  </div>
</template>

<style scoped>
.app-select {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.app-select__label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--muted-color);
}

/* Astérisque d'obligation : même repère visuel que le libellé de l'éditeur riche. */
.app-select__required {
  margin-left: 0.2rem;
  color: var(--primary-color);
}

.app-select__wrap {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
}

/* Icône de tête (contexte) */
.app-select__icon {
  position: absolute;
  left: 0.7rem;
  width: 1rem;
  height: 1rem;
  pointer-events: none;
  color: var(--muted-color);
}

/* Chevron : indicateur d'ouverture, aligné à droite */
.app-select__chevron {
  position: absolute;
  right: 0.7rem;
  width: 1rem;
  height: 1rem;
  pointer-events: none;
  color: var(--muted-color);
  transition: color 0.15s ease;
}

.app-select__native {
  width: 100%;
  min-width: 0;
  appearance: none;
  background-color: color-mix(in oklab, var(--bg-color) 88%, black);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 0.6rem;
  padding: 0.5rem 2.1rem 0.5rem 0.8rem;
  font-size: 0.875rem;
  line-height: 1.35;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.app-select__native--icon {
  padding-left: 2.15rem;
}

.app-select--sm .app-select__native {
  padding-top: 0.32rem;
  padding-bottom: 0.32rem;
  font-size: 0.8125rem;
}

.app-select__native:hover:not(:disabled) {
  border-color: color-mix(in oklab, var(--primary-color) 55%, var(--border-color));
}

.app-select__native:focus-visible {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--primary-color) 28%, transparent);
}

.app-select__native:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* Variante « filtre » : plus discrète, pour les barres d'outils */
.app-select--filter .app-select__native {
  background-color: color-mix(in oklab, var(--bg-color) 72%, transparent);
  border-style: dashed;
}

/* Les options héritent du thème sombre sur les navigateurs qui le gèrent */
.app-select__native option {
  background-color: var(--bg-color);
  color: var(--text-color);
}
</style>
