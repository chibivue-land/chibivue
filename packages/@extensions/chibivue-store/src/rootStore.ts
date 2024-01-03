import { InjectionKey, type App } from 'chibivue'

export let activeStore: Store | undefined
export const setActiveStore = (store: Store | undefined) =>
  (activeStore = store)

export type StateTree = Record<string | number | symbol, any>

export interface Store {
  install: (app: App) => void
  _s: Map<string, StateTree>
}

export const storeSymbol: InjectionKey<Store> = Symbol()
