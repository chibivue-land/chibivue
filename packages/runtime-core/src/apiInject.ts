import { isVapor } from '@chibivue/runtime-vapor'
import { currentInstance } from './component'

export interface InjectionKey<T> extends Symbol {}

export function provide<T>(key: InjectionKey<T> | string | number, value: T) {
  if (!currentInstance) {
    // do nothing
  } else if (isVapor(currentInstance)) {
    // do nothing
  } else {
    let provides = currentInstance.provides
    provides[key as string] = value
  }
}

export function inject<T>(key: InjectionKey<T> | string): T | undefined
export function inject<T>(key: InjectionKey<T> | string) {
  const instance = currentInstance
  if (instance) {
    const provides =
      instance.parent == null
        ? instance.appContext?.provides
        : instance.parent.provides
    if (provides && (key as string | symbol) in provides) {
      return provides[key as string]
    }
  }
}
