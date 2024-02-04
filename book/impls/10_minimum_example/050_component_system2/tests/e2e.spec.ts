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

describe('10_minimum_example/050_component_system2', () => {
  it('should component props', () => {
    const state = reactive({ count: 0 })
    const onClick = vi.fn(() => {
      state.count++
    })
    const Comp = {
      props: { count: { type: Number } },
      setup(props: { count: number }) {
        return () => h('div', {}, [`count: ${props.count}`])
      },
    }

    const App = createApp({
      setup() {
        return () =>
          h('div', { id: 'my-app' }, [
            h(Comp, { count: state.count }, []),
            h('button', { id: 'btn', onClick }, ['increment']),
          ])
      },
    })
    App.mount('#host')

    expect(host.innerHTML).toBe(
      // prettier-ignore
      '<div id="my-app">' + 
        '<div>count: 0</div>' + 
        '<button id="btn">increment</button>' + 
      '</div>',
    )

    const btn = host.querySelector('#btn') as HTMLButtonElement
    btn.click()
    expect(onClick).toHaveBeenCalled()
    expect(host.innerHTML).toBe(
      // prettier-ignore
      '<div id="my-app">' + 
        '<div>count: 1</div>' + 
        '<button id="btn">increment</button>' + 
      '</div>',
    )
  })
})
