import { h } from 'vue'
import { useData, inBrowser } from 'vitepress'
import DefaultTheme from 'vitepress/theme-without-fonts'
import Documate from '@documate/vue'
import './main.css'
import '@documate/vue/dist/style.css'

export default {
  ...DefaultTheme,
  Layout: h(DefaultTheme.Layout, null, {
    'nav-bar-content-before': () =>
      h(Documate, {
        endpoint: 'https://test123.us.aircode.run/ask',
      }),
  }),
  setup() {
    const { lang } = useData()
    if (inBrowser) {
      document.cookie = `nf_lang=${lang.value}; expires=Mon, 1 Jan 2024 00:00:00 UTC; path=/`
    }
  },
}
