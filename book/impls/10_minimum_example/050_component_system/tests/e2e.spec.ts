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

describe('10_minimum_example/050_component_system', () => {
  it('should render component', () => {
    const state = reactive({ count: 0 })
    const onClick = vi.fn(() => {
      state.count++
    })
    const Comp = {
      setup() {
        return () =>
          h('div', {}, [
            h('p', {}, [`count: ${state.count}`]),
            h('button', { id: 'btn', onClick }, ['increment']),
          ])
      },
    }
    const App = createApp({
      setup: () => {
        return () => h('div', { id: 'my-app' }, [h(Comp, {}, [])])
      },
    })
    App.mount('#host')

    expect(host.innerHTML).toBe(
      // prettier-ignore
      '<div id="my-app">' + 
        '<div>' + 
          '<p>count: 0</p>' + 
          '<button id="btn">increment</button>' + 
        '</div>' + 
      '</div>',
    )

    const btn = host.querySelector('#btn') as HTMLButtonElement
    btn.click()
    expect(onClick).toHaveBeenCalled()
    expect(host.innerHTML).toBe(
      // prettier-ignore
      '<div id="my-app">' + 
        '<div>' + 
          '<p>count: 1</p>' + 
          '<button id="btn">increment</button>' + 
        '</div>' + 
      '</div>',
    )
  })
})
