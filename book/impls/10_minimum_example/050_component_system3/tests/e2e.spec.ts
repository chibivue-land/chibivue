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

describe('10_minimum_example/050_component_system3', () => {
  it('should component props and handle emitted event', () => {
    const state = reactive({ count: 0 })
    const onClickIncrement = vi.fn(() => {
      state.count++
    })
    const Comp = {
      props: { count: { type: Number } },
      setup(props: { count: number }, { emit }: any) {
        return () =>
          h('div', {}, [
            h('div', {}, [`count: ${props.count}`]),
            h('button', { id: 'btn', onClick: () => emit('click:increment') }, [
              'increment',
            ]),
          ])
      },
    }

    const App = createApp({
      setup() {
        return () =>
          h('div', { id: 'my-app' }, [
            h(
              Comp,
              { count: state.count, 'onClick:increment': onClickIncrement },
              [],
            ),
          ])
      },
    })
    App.mount('#host')

    expect(host.innerHTML).toBe(
      // prettier-ignore
      '<div id="my-app">' + 
        '<div>' +
          '<div>count: 0</div>' + 
          '<button id="btn">increment</button>' + 
        '</div>' +
      '</div>',
    )

    const btn = host.querySelector('#btn') as HTMLButtonElement
    btn.click()
    expect(onClickIncrement).toHaveBeenCalled()
    expect(host.innerHTML).toBe(
      // prettier-ignore
      '<div id="my-app">' + 
        '<div>' +
          '<div>count: 1</div>' + 
          '<button id="btn">increment</button>' + 
        '</div>' +
      '</div>',
    )
  })
})
