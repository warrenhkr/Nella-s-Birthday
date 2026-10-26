<script setup lang="ts">
const emit = defineEmits<{
  complete: []
}>()

const INTRO_DURATION_MS = 5000
const timer = ref<number | null>(null)

onMounted(() => {
  timer.value = window.setTimeout(() => emit('complete'), INTRO_DURATION_MS)
})

onUnmounted(() => {
  if (timer.value !== null) {
    window.clearTimeout(timer.value)
    timer.value = null
  }
})
</script>

<template>
  <div
    class="site-intro"
    role="status"
    aria-live="polite"
    aria-label="Introduction du site"
  >
    <div
      class="site-intro__frame"
      aria-hidden="true"
    />
    <header class="site-intro__header">
      <span>Osnella Sènami</span>
      <span>Édition anniversaire</span>
    </header>

    <main class="site-intro__content">
      <p class="site-intro__eyebrow">
        Une journée rien qu’à toi
      </p>
      <div
        class="site-intro__seal"
        aria-hidden="true"
      >
        <span class="site-intro__heart">♡</span>
      </div>
      <h1 class="site-intro__title">
        18 <span>ans</span>
      </h1>
      <span
        class="site-intro__divider"
        aria-hidden="true"
      />
      <p class="site-intro__text">
        Une histoire douce, lumineuse et pleine de surprises.
      </p>
    </main>

    <footer class="site-intro__footer">
      <span>Avec tendresse</span>
      <div
        class="site-intro__progress"
        aria-hidden="true"
      >
        <span class="site-intro__progress-fill" />
      </div>
      <span>Pour Osnella Sènami</span>
    </footer>

    <div
      class="site-intro__texture"
      aria-hidden="true"
    />
  </div>
</template>

<style scoped>
.site-intro {
  position: fixed;
  inset: 0;
  z-index: 1800;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 2rem;
  isolation: isolate;
  background: linear-gradient(132deg, #151e25 0%, #24242a 55%, #38242e 100%);
  color: #fff6ed;
}

.site-intro__texture {
  position: absolute;
  z-index: -1;
  inset: 0;
  opacity: 0.28;
  background-image: repeating-linear-gradient(135deg, transparent 0 42px, rgba(255, 246, 237, 0.09) 43px, transparent 44px 86px);
  pointer-events: none;
}

.site-intro__frame {
  position: absolute;
  inset: 1.25rem;
  border: 1px solid rgba(255, 246, 237, 0.16);
  pointer-events: none;
}

.site-intro__header,
.site-intro__footer {
  position: absolute;
  right: max(2rem, env(safe-area-inset-right));
  left: max(2rem, env(safe-area-inset-left));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: rgba(255, 246, 237, 0.68);
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.site-intro__header {
  top: max(2rem, env(safe-area-inset-top));
}

.site-intro__footer {
  bottom: max(2rem, env(safe-area-inset-bottom));
  flex-direction: column;
}

.site-intro__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  animation: intro-arrive 900ms cubic-bezier(0.2, 0.75, 0.2, 1) both;
}

.site-intro__eyebrow {
  color: #8fdbcf;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.site-intro__seal {
  display: grid;
  place-items: center;
  width: 5.5rem;
  height: 5.5rem;
  margin-top: 1.6rem;
  border: 1px solid rgba(242, 199, 135, 0.72);
  border-radius: 50%;
  color: #f2c787;
  animation: seal-breathe 2.4s ease-in-out infinite alternate;
}

.site-intro__heart {
  font-family: Georgia, serif;
  font-size: 2.7rem;
  line-height: 1;
}

.site-intro__title {
  margin-top: 1.15rem;
  font-family: var(--font-display);
  font-size: 5.5rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0;
}

.site-intro__title span {
  color: #f2c787;
  font-family: Georgia, serif;
  font-size: 0.58em;
  font-weight: 400;
}

.site-intro__divider {
  width: 2.5rem;
  height: 1px;
  margin-top: 1.25rem;
  background: #8fdbcf;
}

.site-intro__text {
  margin-top: 1rem;
  max-width: 28rem;
  color: rgba(255, 246, 237, 0.8);
  text-align: center;
  font-size: 0.98rem;
  line-height: 1.6;
}

.site-intro__progress {
  position: relative;
  width: min(12rem, 52vw);
  height: 2px;
  margin-block: 0.15rem;
  overflow: hidden;
  background: rgba(255, 246, 237, 0.22);
}

.site-intro__progress-fill {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform-origin: left center;
  background: linear-gradient(90deg, #8fdbcf, #f2c787);
  animation: intro-progress 5s linear forwards;
}

@keyframes seal-breathe {
  from {
    transform: scale(0.97);
  }
  to {
    transform: scale(1.04);
  }
}

@keyframes intro-arrive {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes intro-progress {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

@media (max-width: 640px) {
  .site-intro {
    padding: 1.5rem;
  }

  .site-intro__frame {
    inset: 0.75rem;
  }

  .site-intro__header,
  .site-intro__footer {
    right: max(1.5rem, env(safe-area-inset-right));
    left: max(1.5rem, env(safe-area-inset-left));
    font-size: 0.55rem;
  }

  .site-intro__title {
    font-size: 4.25rem;
  }

  .site-intro__text {
    max-width: 19rem;
    font-size: 0.9rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .site-intro__content,
  .site-intro__seal,
  .site-intro__progress-fill {
    animation-duration: 1ms;
  }
}
</style>
