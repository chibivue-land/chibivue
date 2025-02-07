import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createApp, h, reactive } from '../packages'

let host: HTMLElement
const initHost = () => {
  host = document.createElement('div')
  host.setAttribute('id', 'host')
  document.body.appendChild(host)
}
beforeEach(() => initHost())
afterEach(() => host.remove())

describe('10_minimum_example/030_reactive_system', () => {
  it('should render reactive state', () => {
    const state = reactive({ count: 0 })
    const onClick = vi.fn(() => {
      state.count++
    })
    const app = createApp({
      setup() {
        return function render() {
          return h('div', { id: 'my-app' }, [
            h('p', {}, [`count: ${state.count}`]),
            h('button', { id: 'btn', onClick }, ['increment']),
          ])
        }
      },
    })
    app.mount('#host')

    expect(host.innerHTML).toBe(
      '<div id="my-app"><p>count: 0</p><button id="btn">increment</button></div>',
    )

    const btn = host.querySelector('#btn') as HTMLButtonElement
    btn.click()
    expect(onClick).toHaveBeenCalled()
    expect(host.innerHTML).toBe(
      '<div id="my-app"><p>count: 1</p><button id="btn">increment</button></div>',
    )
  })
})
