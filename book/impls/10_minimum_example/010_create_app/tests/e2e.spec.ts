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

describe('10_minimum_example/010_create_app', () => {
  it('should render text', () => {
    const app = createApp({
      render() {
        return 'Hello world.'
      },
    })
    app.mount('#host')
    expect(host.innerHTML).toBe('Hello world.')
  })
})
