import { inBrowser, useData } from 'vitepress'
import DefaultTheme from 'vitepress/theme-without-fonts'
import './main.css'

export default {
  ...DefaultTheme,
  setup() {
    const { lang } = useData()
    if (inBrowser) {
      document.cookie = `nf_lang=${lang.value}; expires=Mon, 1 Jan 2024 00:00:00 UTC; path=/`
    }
  },
}
