import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../packages'

let host: HTMLElement
const initHost = () => {
  host = document.createElement('div')
  host.setAttribute('id', 'host')
  document.body.appendChild(host)
}
beforeEach(() => initHost())
afterEach(() => host.remove())

describe('10_minimum_example/060_template_compiler', () => {
  it('should render template option', () => {
    const app = createApp({
      template: `
      <div class="container" style="text-align: center">
        <h2>Hello, chibivue!</h2>
        <img
          width="150px"
          src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png"
          alt="Vue.js Logo"
        />
        <p><b>chibivue</b> is the minimal Vue.js</p>
  
        <style>
          .container {
            height: 100vh;
            padding: 16px;
            background-color: #becdbe;
            color: #2c3e50;
          }
        </style>
      </div>
    `,
    })
    app.mount('#host')

    expect(host.innerHTML).toBe(
      `<div class="container" style="text-align: center">
        <h2>Hello, chibivue!</h2>
        <img width="150px" src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png" alt="Vue.js Logo">
        <p><b>chibivue</b> is the minimal Vue.js</p>
  
        <style>
          .container {
            height: 100vh;
            padding: 16px;
            background-color: #becdbe;
            color: #2c3e50;
          }
        </style>
      </div>`,
    )
  })
})
