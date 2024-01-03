import { ReactiveEffect } from '../reactivity'
import { hasChanged } from '../shared'

export type WatchEffect = (onCleanup: OnCleanup) => void

export type WatchSource<T = any> = () => T

type OnCleanup = (cleanupFn: () => void) => void

export function watch<T>(
  source: WatchSource<T>,
  cb: (newValue: T, oldValue: T) => void,
) {
  const getter = () => source()
  let oldValue = getter()
  const job = () => {
    const newValue = getter()
    if (hasChanged(newValue, oldValue)) {
      cb(newValue, oldValue)
      oldValue = newValue
    }
  }

  const effect = new ReactiveEffect(getter, job)
  effect.run()
}
