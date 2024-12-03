import { createApp } from 'chibivue'

// @ts-expect-error
import App from './App.vue'
// @ts-expect-error
import Counter from './components/Counter.vue'

const app = createApp(App)

app.component('GlobalCounter', Counter)

app.mount('#app')
