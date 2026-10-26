<template>
  <div class="filiere-select">
    <div class="filiere-field">
      <label for="filiere-universite">Université <span>*</span></label>
      <AppSelect
        id="filiere-universite"
        v-model="selectedUni"
        class="filiere-control"
        :options="universityItems"
        icon="i-lucide-graduation-cap"
        placeholder="Sélectionne ton université"
        @update:model-value="onUniChange"
      />
    </div>
    <div
      v-if="selectedUni && !isAutreUni"
      class="filiere-field"
    >
      <label for="filiere-faculte">Faculté / école <span>*</span></label>
      <AppSelect
        id="filiere-faculte"
        v-model="selectedFac"
        class="filiere-control"
        :options="facultyItems"
        icon="i-lucide-building-2"
        placeholder="Sélectionne ta faculté ou ton école"
        @update:model-value="onFacChange"
      />
    </div>
    <div
      v-if="showFreeText || selectedFac"
      class="filiere-field"
    >
      <label for="filiere-filiere">Filière <span>*</span></label>
      <UInput
        v-if="showFreeText"
        id="filiere-filiere"
        v-model="customFil"
        class="filiere-control"
        placeholder="Précise ta filière"
        @update:model-value="emitValue"
      />
      <AppSelect
        v-else
        id="filiere-filiere"
        v-model="selectedFil"
        class="filiere-control"
        :options="filieresDisponibles"
        icon="i-lucide-book-open"
        placeholder="Sélectionne ta filière"
        @update:model-value="emitValue"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ETABLISSEMENTS_BENIN, type Faculte } from '../../data/etablissements-benin'

export interface FiliereValue {
  universite: string
  faculte: string
  filiere: string
}

const props = defineProps<{ modelValue: FiliereValue }>()
const emit = defineEmits<{ 'update:modelValue': [value: FiliereValue] }>()
const selectedUni = ref(props.modelValue.universite || '')
const selectedFac = ref(props.modelValue.faculte || '')
const selectedFil = ref(props.modelValue.filiere || '')
const customFil = ref('')
const universityItems = computed(() => ETABLISSEMENTS_BENIN.map(item => item.universite))
const universityData = computed(() => ETABLISSEMENTS_BENIN.find(item => item.universite === selectedUni.value) || null)
const facultyData = computed<Faculte | null>(() => universityData.value?.facultes.find(item => item.nom === selectedFac.value) || null)
const facultyItems = computed(() => universityData.value?.facultes.map(item => item.nom) || [])
const filieresDisponibles = computed(() => facultyData.value?.filieres || [])
const isAutreUni = computed(() => selectedUni.value.startsWith('Autre /'))
const showFreeText = computed(() => isAutreUni.value || selectedFac.value === 'Autre' || (facultyData.value !== null && filieresDisponibles.value.length === 0))

function emitValue() {
  emit('update:modelValue', {
    universite: selectedUni.value,
    faculte: isAutreUni.value ? '' : selectedFac.value,
    filiere: showFreeText.value ? customFil.value.trim() : selectedFil.value
  })
}

function onUniChange() {
  selectedFac.value = ''
  selectedFil.value = ''
  customFil.value = ''
  emitValue()
}

function onFacChange() {
  selectedFil.value = ''
  customFil.value = ''
  emitValue()
}

watch(() => props.modelValue, (value) => {
  selectedUni.value = value.universite || ''
  selectedFac.value = value.faculte || ''
  selectedFil.value = value.filiere || ''
}, { deep: true })
</script>

<style scoped>
.filiere-select {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}

.filiere-field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  width: 100%;
}

.filiere-field label {
  color: var(--text-color);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.filiere-field label span {
  color: var(--primary-color);
}

.filiere-control {
  width: 100%;
}

:deep(.filiere-control button),
:deep(.filiere-control input) {
  min-height: 2.85rem;
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  background: rgba(var(--primary-color-rgb), 0.06);
  color: var(--text-color);
  box-shadow: 0 8px 24px -18px rgba(var(--primary-color-rgb), 0.9);
}

:deep(.filiere-control button:hover),
:deep(.filiere-control input:focus) {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.16);
}

:deep(.filiere-control button > span),
:deep(.filiere-control input::placeholder) {
  color: var(--muted-color);
}

:deep([data-slot='content']) {
  border: 1px solid var(--border-color);
  background: var(--bg-color-soft);
  color: var(--text-color);
}
</style>
