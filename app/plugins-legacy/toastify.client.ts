import Vue3Toastify, { type ToastContainerOptions } from 'vue3-toastify'
import 'vue3-toastify/dist/index.css'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(Vue3Toastify, {
    autoClose: 3200,
    theme: 'dark',
    position: 'bottom-right',
    hideProgressBar: false,
    newestOnTop: true,
  } as ToastContainerOptions)
})
