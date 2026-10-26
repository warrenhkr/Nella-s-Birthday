<script setup lang="ts">
const acceptedCommands = ['ls', 'cd /love', 'cat message.txt', 'open gift']
const commandIndex = ref(0)
const input = ref('')
const solved = ref(false)
const lines = ref<string[]>([
  'Bienvenue dans le terminal secret.',
  'Tape la commande qui ouvre le cœur.',
  '> ls'
])

function sendCommand() {
  const value = input.value.trim().toLowerCase()

  if (!value) {
    return
  }

  const expected = acceptedCommands[commandIndex.value]

  if (value === expected) {
    lines.value.push(`> ${value}`)
    lines.value.push('✅ Commande validée.')
    commandIndex.value += 1

    if (commandIndex.value >= acceptedCommands.length) {
      solved.value = true
      lines.value.push('✨ Message déverrouillé : “Tu es mon plus beau code.”')
    } else {
      lines.value.push(`Indice suivant : ${acceptedCommands[commandIndex.value]}`)
    }
  } else {
    lines.value.push(`> ${value}`)
    lines.value.push(`❌ Commande inconnue. Essaie : ${expected}`)
  }

  input.value = ''
}
</script>

<template>
  <div class="rounded-[28px] border border-pink-200/15 bg-[#0d0613] p-4 shadow-[0_0_30px_rgba(244,114,182,0.12)]">
    <div class="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-pink-100/60">
      <span class="h-2.5 w-2.5 rounded-full bg-emerald-400" />
      <span>root@love-terminal</span>
    </div>

    <div class="space-y-2 rounded-2xl border border-pink-200/10 bg-[#120b1d] p-3 font-mono text-sm text-pink-100/80">
      <p v-for="line in lines" :key="line" class="whitespace-pre-wrap">{{ line }}</p>
    </div>

    <form class="mt-4 flex min-w-0 gap-2" @submit.prevent="sendCommand">
      <span class="font-mono text-pink-200">$</span>
      <input
        v-model="input"
        type="text"
        placeholder="tape une commande"
        class="min-w-0 flex-1 rounded-xl border border-pink-200/15 bg-[#1a0f22] px-3 py-2 font-mono text-sm text-white outline-none placeholder:text-pink-100/35"
      />
      <button type="submit" class="rounded-xl bg-pink-500/20 px-3 py-2 text-sm text-pink-100 ring-1 ring-pink-200/20">
        Envoyer
      </button>
    </form>

    <div v-if="solved" class="mt-4 rounded-2xl border border-amber-300/30 bg-amber-500/10 p-3 text-sm text-amber-100">
      Message secret trouvé : tu es mon meilleur bug préféré.
    </div>
  </div>
</template>
