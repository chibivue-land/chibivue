import { createApp, h, shallowRef, triggerRef } from 'chibivue'

const app = createApp({
  setup() {
    const state = shallowRef({ count: 0 })
    const forceUpdate = () => {
      triggerRef(state)
    }

    return () =>
      h('div', {}, [
        h('p', {}, [`count: ${state.value.count}`]),

        h(
          'button',
          {
            onClick: () => {
              state.value = { count: state.value.count + 1 }
            },
          },
          ['increment'],
        ),

        h(
          'button', // clickしても描画は更新されない
          {
            onClick: () => {
              state.value.count++
            },
          },
          ['not trigger ...'],
        ),

        h(
          'button', // 描画が今の state.value.count が持つ値に更新される
          { onClick: forceUpdate },
          ['force update !'],
        ),
      ])
  },
})

app.mount('#app')
