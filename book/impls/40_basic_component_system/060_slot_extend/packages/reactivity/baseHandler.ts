import { hasChanged, isArray, isObject } from '../shared'
import { ITERATE_KEY, track, trigger } from './effect'
import {
  ReactiveFlags,
  Target,
  isReadonly,
  reactive,
  readonly,
  toRaw,
} from './reactive'

const get = createGetter()
const shallowGet = createGetter(false, true)
const readonlyGet = createGetter(true)

function createGetter(isReadonly = false, shallow = false) {
  return function get(target: Target, key: string | symbol, receiver: object) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly
    } else if (key === ReactiveFlags.IS_SHALLOW) {
      return shallow
    } else {
      track(target, key)
      const res = Reflect.get(target, key, receiver)
      if (isObject(res)) {
        return isReadonly ? readonly(res) : reactive(res)
      }
      return res
    }
  }
}

const set = createSetter()
const shallowSet = createSetter(true)

function createSetter(shallow = false) {
  return function set(
    target: object,
    key: string | symbol,
    value: unknown,
    receiver: object,
  ): boolean {
    if (isReadonly(target)) return false

    let oldValue = (target as any)[key]
    if (!shallow) {
      oldValue = toRaw(oldValue)
      value = toRaw(value)
    } else {
    }

    const result = Reflect.set(target, key, value, receiver)
    if (hasChanged(value, oldValue)) {
      trigger(target, key)
    }

    return result
  }
}

export const mutableHandlers: ProxyHandler<object> = {
  get,
  set,
  ownKeys(target) {
    track(target, isArray(target) ? 'length' : ITERATE_KEY)
    return Reflect.ownKeys(target)
  },
}

export const readonlyHandlers: ProxyHandler<object> = {
  get: readonlyGet,
  set(_target, _key) {
    return true
  },
  deleteProperty(_target, _key) {
    return true
  },
}

export const shallowReactiveHandlers = Object.assign({}, mutableHandlers, {
  get: shallowGet,
  set: shallowSet,
})
