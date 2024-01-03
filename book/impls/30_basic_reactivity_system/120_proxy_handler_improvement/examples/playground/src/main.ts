import { createApp, h, reactive, ref } from 'chibivue'

const ReactiveCollection = {
  setup() {
    const state = reactive({ map: new Map(), set: new Set() })

    const array = ref<number[]>([])
    const mutateArray = () => {
      array.value.push(Date.now())
    }

    const record = reactive<Record<string, number>>({})
    const mutateRecord = () => {
      record[Date.now().toString()] = Date.now()
    }

    return () =>
      h('div', {}, [
        h('h1', {}, [`ReactiveCollection`]),

        h('p', {}, [`array: ${JSON.stringify(array.value)}`]),
        h('button', { onClick: mutateArray }, ['update array']),

        h('p', {}, [`record: ${JSON.stringify(record)}`]),
        h('button', { onClick: mutateRecord }, ['update record']),

        h('p', {}, [
          `map (${state.map.size}): ${JSON.stringify([...state.map])}`,
        ]),
        h('button', { onClick: () => state.map.set(Date.now(), 'item') }, [
          'update map',
        ]),

        h('p', {}, [
          `set (${state.set.size}): ${JSON.stringify([...state.set])}`,
        ]),
        h('button', { onClick: () => state.set.add(Date.now()) }, [
          'update set',
        ]),
      ])
  },
}

const app = createApp({
  setup: () => () => h('div', {}, [h(ReactiveCollection, {}, [])]),
})

app.mount('#app')
