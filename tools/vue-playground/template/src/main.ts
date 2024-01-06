import { createApp } from 'vue'

// @ts-ignore
const modules = import.meta.glob('./*.(vue|js)')
const mod = (modules['.' + location.pathname] || modules['./App.vue'])()

mod.then(({ default: mod }: any) => createApp(mod).mount('#app'))
