import { type EffectScope, getCurrentInstance, inject } from 'chibivue'
import {
  type StateTree,
  type Store,
  activeStore,
  setActiveStore,
  storeSymbol,
} from './rootStore'

export function defineStore<Id extends string>(id: Id, setup: () => StateTree) {
  function useStore(store?: Store | null) {
    const currentInstance = getCurrentInstance()
    store = currentInstance && inject(storeSymbol)
    if (store) setActiveStore(store)
    store = activeStore!

    if (!store._s.has(id)) {
      createSetupStore(id, setup, store)
    }

    const _store = store!._s.get(id)!
    return _store
  }

  return useStore
}

function createSetupStore<Id extends string>(
  id: Id,
  setup: () => StateTree,
  store: Store,
) {
  let scope!: EffectScope
  const _store = setup()
  store._s.set(id, _store)
}
