import { hasChanged, isArray, isObject } from '../shared'
import { ITERATE_KEY, track, trigger } from './effect'
import { reactive } from './reactive'

export const mutableHandlers: ProxyHandler<object> = {
  get(target: object, key: string | symbol, receiver: object) {
    track(target, key)

    const res = Reflect.get(target, key, receiver)
    if (isObject(res)) {
      return reactive(res)
    }

    return res
  },

  set(target: object, key: string | symbol, value: unknown, receiver: object) {
    let oldValue = (target as any)[key]
    Reflect.set(target, key, value, receiver)
    if (hasChanged(value, oldValue)) {
      trigger(target, key)
    }
    return true
  },

  ownKeys(target) {
    track(target, isArray(target) ? 'length' : ITERATE_KEY)
    return Reflect.ownKeys(target)
  },
}
