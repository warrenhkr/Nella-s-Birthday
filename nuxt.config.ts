// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  extends: ['./lot-analyste-entreprise'],

  nitro: {
    publicAssets: [
      { dir: 'public', baseURL: '/', maxAge: 0 },
      { dir: 'lot-analyste-entreprise/public', baseURL: '/', maxAge: 0 }
    ]
  },

  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxt/fonts',
    '@vueuse/nuxt',
    '@pinia/nuxt'
  ],

  plugins: [
    { src: '~/plugins-legacy/audio-unlock.client.ts', mode: 'client' },
    { src: '~/plugins-legacy/vidstack.client.ts', mode: 'client' }
  ],

  components: [
    { path: '~/components-legacy', pathPrefix: false, ignore: ['**/FloatingIcons.vue'] },
    { path: '~/components', pathPrefix: false, ignore: ['**/mini-jeux/**'] }
  ],

  devtools: {
    enabled: false
  },

  app: {
    pageTransition: {
      name: 'birthday-page',
      mode: 'default'
    }
  },


  vue: {
    compilerOptions: {
      isCustomElement: (tag) => tag.startsWith('media-')
    }
  },
  css: [
    '~/assets/css/main.css'
  ],

  compatibilityDate: '2026-06-30',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
