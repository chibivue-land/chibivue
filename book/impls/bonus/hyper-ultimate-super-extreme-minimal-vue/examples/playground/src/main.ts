import { createApp } from 'hyper-ultimate-super-extreme-minimal-vue'

// @ts-expect-error
import App from './App.vue'

const app = createApp(App)
app.mount('#app')
