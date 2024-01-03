import { isFunction } from '../shared'
import { Dep } from './dep'
import { ReactiveEffect } from './effect'
import { Ref, trackRefValue, triggerRefValue } from './ref'

declare const ComputedRefSymbol: unique symbol

export interface ComputedRef<T = any> extends Ref {
  readonly value: T
  [ComputedRefSymbol]: true
}

export type ComputedGetter<T> = (...args: any[]) => T
export type ComputedSetter<T> = (v: T) => void
export interface WritableComputedOptions<T> {
  get: ComputedGetter<T>
  set: ComputedSetter<T>
}

export class ComputedRefImpl<T> {
  public dep?: Dep = undefined

  private _value!: T
  public readonly effect: ReactiveEffect<T>

  public readonly __v_isRef = true
  public _dirty = true

  constructor(
    getter: ComputedGetter<T>,
    private readonly _setter: ComputedSetter<T>,
  ) {
    this.effect = new ReactiveEffect(getter, () => {
      if (!this._dirty) {
        this._dirty = true
        triggerRefValue(this)
      }
    })
  }

  get value() {
    trackRefValue(this)
    if (this._dirty) {
      this._dirty = false
      this._value = this.effect.run()
    }
    return this._value
  }

  set value(newValue: T) {
    this._setter(newValue)
  }
}

export function computed<T>(getterOrOptions: ComputedGetter<T>): ComputedRef<T>
export function computed<T>(getterOrOptions: WritableComputedOptions<T>): Ref<T>
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>,
) {
  let getter: ComputedGetter<T>
  let setter: ComputedSetter<T>

  const onlyGetter = isFunction(getterOrOptions)

  if (onlyGetter) {
    getter = getterOrOptions
    setter = () => {}
  } else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }
  return new ComputedRefImpl(getter, setter) as any
}
