export type AppTheme = 'dark' | 'light'
export type VisualStyle = 'persona' | 'cyberpunk'

const themeStorageKey = 'otaku-theme-v3'
const styleStorageKey = 'otaku-visual-style-v2'

export function useThemeStore() {
  const theme = useState<AppTheme>('otaku-theme', () => 'dark')
  const visualStyle = useState<VisualStyle>('otaku-visual-style', () => 'persona')
  const isReady = useState<boolean>('otaku-theme-ready', () => false)

  const rootClasses = computed(() => [
    `theme-${theme.value}`,
    `style-${visualStyle.value}`
  ])

  const rootStyle = computed(() => ({
    '--bg-color': theme.value === 'light' ? '#fff8fb' : '#1d1219',
    '--panel-color': theme.value === 'light' ? 'rgba(255, 255, 255, 0.92)' : 'rgba(41, 26, 34, 0.9)',
    '--primary-color': visualStyle.value === 'persona' ? '#c94e7b' : '#d54f8e',
    '--accent-color': visualStyle.value === 'persona' ? '#f0a9c0' : '#ffb7d1',
    '--text-color': theme.value === 'light' ? '#3b2530' : '#fff4f8',
    '--muted-color': theme.value === 'light' ? '#806975' : '#d4bac5',
    '--border-color': theme.value === 'light' ? 'rgba(201, 78, 123, 0.16)' : 'rgba(255, 225, 235, 0.14)',
    '--clip-path': visualStyle.value === 'persona'
      ? 'polygon(0 0, 94% 0, 100% 14%, 100% 100%, 6% 100%, 0 86%)'
      : 'polygon(0 0, 96% 0, 100% 12%, 100% 100%, 4% 100%, 0 88%)'
  }))

  function applyTheme() {
    if (!import.meta.client) return

    document.documentElement.dataset.theme = theme.value
    document.documentElement.dataset.visualStyle = visualStyle.value
    document.documentElement.classList.toggle('theme-light', theme.value === 'light')
    document.documentElement.classList.toggle('theme-dark', theme.value === 'dark')
    document.documentElement.classList.toggle('style-persona', visualStyle.value === 'persona')
    document.documentElement.classList.toggle('style-cyberpunk', visualStyle.value === 'cyberpunk')

    localStorage.setItem(themeStorageKey, theme.value)
    localStorage.setItem(styleStorageKey, visualStyle.value)
  }

  function setTheme(nextTheme: AppTheme) {
    theme.value = nextTheme
    applyTheme()
  }

  function toggleTheme() {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  function setVisualStyle(nextStyle: VisualStyle) {
    visualStyle.value = nextStyle
    applyTheme()
  }

  function toggleVisualStyle() {
    setVisualStyle(visualStyle.value === 'persona' ? 'cyberpunk' : 'persona')
  }

  function hydrate() {
    if (!import.meta.client || isReady.value) return

    const savedTheme = localStorage.getItem(themeStorageKey)
    const savedStyle = localStorage.getItem(styleStorageKey)

    if (savedTheme === 'dark' || savedTheme === 'light') theme.value = savedTheme
    if (savedStyle === 'persona' || savedStyle === 'cyberpunk') visualStyle.value = savedStyle

    applyTheme()
    isReady.value = true
  }

  return {
    theme: readonly(theme),
    visualStyle: readonly(visualStyle),
    rootClasses,
    rootStyle,
    isReady: readonly(isReady),
    hydrate,
    setTheme,
    toggleTheme,
    setVisualStyle,
    toggleVisualStyle
  }
}
