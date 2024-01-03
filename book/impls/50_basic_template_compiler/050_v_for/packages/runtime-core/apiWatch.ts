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

export type WatchEffect = () => void

export type WatchSource<T = any> = (() => T) | Ref<T> | ComputedRef<T>

export type WatchCallback<V = any, OV = any> = (
  value: V,
  oldValue: OV,
  onCleanup: OnCleanup,
) => void

const INITIAL_WATCHER_VALUE = {}

export interface WatchOptions<Immediate = boolean> {
  immediate?: Immediate
  deep?: boolean
}

type OnCleanup = (cleanupFn: () => void) => void

export function watch<T>(
  source: WatchSource<T> | WatchSource[],
  cb: WatchCallback,
  option?: WatchOptions,
) {
  return doWatch(source, cb, option)
}

export function watchEffect(source: WatchEffect) {
  doWatch(source, null)
}

function doWatch(
  source: WatchSource | WatchSource[] | WatchEffect,
  cb: WatchCallback | null,
  option: WatchOptions = {},
) {
  let getter: () => any
  let isMultiSource = false
  if (isFunction(source)) {
    getter = () => source()
  } else if (isRef(source)) {
    getter = () => source.value
  } else if (isArray(source)) {
    isMultiSource = true
    getter = () => source.map(s => (isRef(s) ? s.value : s))
  } else {
    if (isObject(source)) option.deep = true
    getter = () => source
  }

  if (cb && option.deep) {
    const baseGetter = getter
    getter = () => traverse(baseGetter())
  }

  let cleanup: () => void
  let onCleanup: OnCleanup = (fn: () => void) => {
    cleanup = effect.onStop = () => {
      fn()
    }
  }

  let oldValue: any = isMultiSource
    ? new Array((source as []).length).fill(INITIAL_WATCHER_VALUE)
    : INITIAL_WATCHER_VALUE

  const job = () => {
    if (cb) {
      const newValue = effect.run()
      if (
        option.deep ||
        (isMultiSource
          ? (newValue as any[]).some((v, i) =>
              hasChanged(v, (oldValue as any[])?.[i]),
            )
          : hasChanged(newValue, oldValue))
      ) {
        // cleanup before running cb again
        if (cleanup) {
          cleanup()
        }
        cb(newValue, oldValue, onCleanup)
        oldValue = newValue
      }
    } else {
      // watchEffect
      effect.run()
    }
  }

  const effect = new ReactiveEffect(getter, job)

  // initial run
  if (option.immediate) {
    job()
  } else {
    oldValue = effect.run()
  }

  const unwatch = () => {
    effect.stop()
  }

  return unwatch
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
