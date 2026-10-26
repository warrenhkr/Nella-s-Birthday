// ============================================================
// useGameToast — notifications "HUD de jeu" par-dessus vue3-toastify
//
// Le plugin vue3-toastify est enregistré globalement dans
// app/plugins/toastify.client.ts (thème sombre, position, durée).
// Ce composable ne fait qu'exposer des helpers sémantiques avec un
// style néon cohérent avec le thème courant (persona / cyberpunk).
// ============================================================
import { toast, type ToastOptions } from 'vue3-toastify'

export type GameToastKind = 'success' | 'alert' | 'info'

const ICONS: Record<GameToastKind, string> = {
  success: '✔',
  alert: '⚠',
  info: 'ℹ',
}

function baseOptions(kind: GameToastKind): ToastOptions {
  return {
    // Classe custom : le style biseauté/néon réel vit dans
    // app/assets/css/main.css (.Toastify__toast--otaku-*), voir plus bas.
    toastClassName: `otaku-toast otaku-toast--${kind}`,
    bodyClassName: 'otaku-toast__body',
    icon: () => ICONS[kind],
    autoClose: kind === 'alert' ? 5000 : 3200,
    closeOnClick: true,
    pauseOnHover: true,
  }
}

export function useGameToast() {
  function success(message: string, options?: ToastOptions) {
    toast.success(message, { ...baseOptions('success'), ...options })
  }

  function alert(message: string, options?: ToastOptions) {
    toast.error(message, { ...baseOptions('alert'), ...options })
  }

  function info(message: string, options?: ToastOptions) {
    toast.info(message, { ...baseOptions('info'), ...options })
  }

  return { success, alert, info }
}
