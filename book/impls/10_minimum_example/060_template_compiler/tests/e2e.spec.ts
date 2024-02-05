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
      template: `<b class="hello" style="color: red;">Hello World!!</b>`,
    })
    app.mount('#host')

    expect(host.innerHTML).toBe(
      '<b class="hello" style="color: red;">Hello World!!</b>',
    )
  })
})
