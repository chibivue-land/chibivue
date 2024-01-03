import { createApp } from 'chibivue'

// @ts-ignore
import App from './App.vue'
// @ts-ignore
import Counter from './components/Counter.vue'

const app = createApp(App)

app.component('GlobalCounter', Counter)

app.mount('#app')
