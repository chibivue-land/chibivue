import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createApp, h } from '../packages'

let host: HTMLElement
const initHost = () => {
  host = document.createElement('div')
  host.setAttribute('id', 'host')
  document.body.appendChild(host)
}
beforeEach(() => initHost())
afterEach(() => host.remove())

describe('10_minimum_example/020_simple_h_function', () => {
  it('should render vdom and trigger click handler', () => {
    const onClick = vi.fn(() => {})
    const app = createApp({
      render() {
        return h('div', { id: 'my-app' }, [
          h('p', { style: 'color: red; font-weight: bold;' }, ['Hello world.']),
          h('button', { id: 'btn', onClick }, ['click me!']),
        ])
      },
    })
    app.mount('#host')

    expect(host.innerHTML).toBe(
      '<div id="my-app"><p style="color: red; font-weight: bold;">Hello world.</p><button id="btn">click me!</button></div>',
    )

    const btn = host.querySelector('#btn') as HTMLButtonElement
    btn.click()
    expect(onClick).toHaveBeenCalled()
  })
})
