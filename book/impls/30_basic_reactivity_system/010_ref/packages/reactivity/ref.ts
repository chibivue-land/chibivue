import { Dep, createDep } from './dep'
import { trackEffects, triggerEffects } from './effect'
import { toReactive } from './reactive'

declare const RefSymbol: unique symbol

type RefBase<T> = {
  dep?: Dep
  value: T
}

export interface Ref<T = any> {
  value: T
  [RefSymbol]: true
}

export function trackRefValue(ref: RefBase<any>) {
  trackEffects(ref.dep || (ref.dep = createDep()))
}

export function triggerRefValue(ref: RefBase<any>) {
  if (ref.dep) triggerEffects(ref.dep)
}

export function isRef<T>(r: Ref<T> | unknown): r is Ref<T>
export function isRef(r: any): r is Ref {
  return !!(r && r.__v_isRef === true)
}

export function ref<T = any>(): Ref<T | undefined>
export function ref<T = any>(value: T): Ref<T>
export function ref(value?: unknown) {
  return createRef(value)
}

function createRef(rawValue: unknown) {
  if (isRef(rawValue)) {
    return rawValue
  }
  return new RefImpl(rawValue)
}

class RefImpl<T> {
  private _value: T
  public dep?: Dep = undefined
  public readonly __v_isRef = true

  constructor(value: T) {
    this._value = toReactive(value)
  }

  get value() {
    trackRefValue(this)
    return this._value
  }

  set value(newVal) {
    this._value = toReactive(newVal)
    triggerRefValue(this)
  }
}
