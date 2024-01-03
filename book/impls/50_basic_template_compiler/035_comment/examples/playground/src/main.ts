import { createApp, defineComponent } from 'chibivue'

const App = defineComponent({
  template: `
  <!-- this is heder. -->
  <header>header</header>

  <!-- 
    this is main.
    main content is here!
  -->
  <main>main</main>

  <!-- this is footer -->
  <footer>footer</footer>`,
})

const app = createApp(App)

app.mount('#app')
