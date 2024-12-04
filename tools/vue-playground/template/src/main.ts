import { createApp } from 'vue'

// @ts-expect-error
const modules = import.meta.glob('./*.(vue|js)')
const mod = (modules['.' + location.pathname] || modules['./App.vue'])()

mod.then(({ default: mod }: any) => createApp(mod).mount('#app'))
