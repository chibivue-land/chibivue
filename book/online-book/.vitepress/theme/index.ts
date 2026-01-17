import { inBrowser, useData } from 'vitepress'
import DefaultTheme from 'vitepress/theme-without-fonts'
import Layout from './Layout.vue'
import KawaikoNote from './components/KawaikoNote.vue'
import './main.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('KawaikoNote', KawaikoNote)
  },
  setup() {
    const { lang } = useData()
    if (inBrowser) {
      document.cookie = `nf_lang=${lang.value}; expires=Mon, 1 Jan 2030 00:00:00 UTC; path=/`
    }
  },
}
