import { ComputedRef, ReactiveEffect, Ref, isRef } from '../reactivity'
import {
  hasChanged,
  isArray,
  isFunction,
  isMap,
  isObject,
  isPlainObject,
  isSet,
} from '../shared'

export type WatchEffect = (onCleanup: OnCleanup) => void

export type WatchSource<T = any> = (() => T) | Ref<T> | ComputedRef<T> | object

export type WatchCallback<V = any, OV = any> = (value: V, oldValue: OV) => void

type OnCleanup = (cleanupFn: () => void) => void

export interface WatchOptions<Immediate = boolean> {
  immediate?: Immediate
  deep?: boolean
}

export function watch<T>(
  source: WatchSource<T> | WatchSource[],
  cb: WatchCallback,
  option: WatchOptions = {},
) {
  let getter: () => any
  let isMultiSource = false
  if (isFunction(source)) {
    getter = () => source()
  } else if (isRef<T>(source)) {
    getter = () => source.value
  } else if (isArray(source)) {
    isMultiSource = true
    getter = () => source.map(s => (isRef(s) ? s.value : s))
  } else {
    if (isObject(source)) option.deep = true
    getter = () => source
  }

  if (option.deep) {
    const baseGetter = getter
    getter = () => traverse(baseGetter())
  }

  let oldValue: T | T[]
  const job = () => {
    const newValue = effect.run()
    if (
      option.deep ||
      (isMultiSource
        ? (newValue as any[]).some((v, i) =>
            hasChanged(v, (oldValue as T[])?.[i]),
          )
        : hasChanged(newValue, oldValue))
    ) {
      cb(newValue, oldValue)
      oldValue = newValue
    }
  }

  const effect = new ReactiveEffect(getter, job)

  // initial run
  if (option.immediate) {
    job()
  } else {
    oldValue = effect.run()
  }
}

export function traverse(value: unknown, seen?: Set<unknown>) {
  if (!isObject(value)) return value

  seen = seen || new Set()
  if (seen.has(value)) {
    return value
  }
  seen.add(value)
  if (isRef(value)) {
    traverse(value.value, seen)
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], seen)
    }
  } else if (isSet(value) || isMap(value)) {
    value.forEach((v: any) => {
      traverse(v, seen)
    })
  } else if (isPlainObject(value)) {
    for (const key in value) {
      traverse(value[key], seen)
    }
  }
  return value
}
