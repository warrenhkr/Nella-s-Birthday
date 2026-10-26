<script setup lang="ts">
// ============================================================
// AdminScopePicker — choix des PÉRIMÈTRES d'un administrateur.
//
// Sert à la fois au SUPER_ADMIN (page /dashboard-super-admin) et à
// l'ADMIN_INTERMÉDIAIRE (onglet « Administrateurs » de /dashboard) au moment
// de nommer un administrateur ou de modifier ses accès.
//
// Règle affichée noir sur blanc : aucun périmètre coché = administrateur
// COMPLET (comportement historique), un ou plusieurs périmètres cochés =
// administrateur limité à ces domaines — côté serveur (gardes des routes API)
// ET côté interface (pages, navigation).
// ============================================================
import { ADMIN_SCOPES, adminScopeLabels, normalizeAdminScopes, type AdminScope } from '#shared/admin-scopes'

const props = withDefaults(defineProps<{
  modelValue: string[]
  disabled?: boolean
  label?: string
}>(), {
  disabled: false,
  label: 'Périmètres d’administration'
})

const emit = defineEmits<{
  'update:modelValue': [value: AdminScope[]]
}>()

const selected = computed(() => normalizeAdminScopes(props.modelValue))
const isFullAccess = computed(() => selected.value.length === 0)
const summary = computed(() => isFullAccess.value
  ? 'Administrateur complet : toutes les parties de l’administration.'
  : `Administrateur limité à : ${adminScopeLabels(selected.value)}.`)

function toggleScope(scope: AdminScope, checked: unknown) {
  const next = new Set(selected.value)
  if (checked === true) next.add(scope)
  else next.delete(scope)
  emit('update:modelValue', normalizeAdminScopes([...next]))
}
</script>

<template>
  <fieldset
    class="scope-picker"
    :disabled="disabled"
  >
    <legend class="scope-picker__legend">
      {{ label }}
    </legend>
    <p class="scope-picker__hint">
      Ne rien cocher = administrateur complet (comportement actuel).
    </p>

    <div class="scope-picker__grid">
      <UCheckbox
        v-for="scope in ADMIN_SCOPES"
        :key="scope.value"
        :model-value="selected.includes(scope.value)"
        :label="scope.label"
        :disabled="disabled"
        @update:model-value="(checked: unknown) => toggleScope(scope.value, checked)"
      >
        <template #description>
          <span class="scope-picker__description">{{ scope.description }}</span>
        </template>
      </UCheckbox>
    </div>

    <p
      class="scope-picker__summary"
      :class="{ 'scope-picker__summary--limited': !isFullAccess }"
    >
      <UIcon
        :name="isFullAccess ? 'i-lucide-shield-check' : 'i-lucide-shield-alert'"
        class="h-4 w-4"
        aria-hidden="true"
      />
      <span>{{ summary }}</span>
    </p>
  </fieldset>
</template>

<style scoped>
.scope-picker {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0.85rem;
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--surface-color) 88%, transparent);
  min-inline-size: 0;
}

.scope-picker__legend {
  padding: 0 0.35rem;
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-muted, #a1a1aa);
}

.scope-picker__hint,
.scope-picker__description {
  font-size: 0.72rem;
  color: var(--text-muted, #a1a1aa);
}

.scope-picker__grid {
  display: grid;
  gap: 0.35rem;
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
}

.scope-picker__summary {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  color: var(--text-color);
}

.scope-picker__summary--limited {
  color: #fbbf24;
}
</style>
