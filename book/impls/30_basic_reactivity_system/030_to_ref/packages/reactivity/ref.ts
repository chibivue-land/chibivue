import { IfAny } from '../shared'
import { Dep, createDep } from './dep'
import { getDepFromReactive, trackEffects, triggerEffects } from './effect'
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

/*
 *
 * ref
 *
 */
export function ref<T = any>(): Ref<T | undefined>
export function ref<T = any>(value: T): Ref<T>
export function ref(value?: unknown) {
  return createRef(value, false)
}

/*
 *
 * shallow ref
 *
 */
declare const ShallowRefMarker: unique symbol
export type ShallowRef<T = any> = Ref<T> & { [ShallowRefMarker]?: true }

export function shallowRef<T extends object>(
  value: T,
): T extends Ref ? T : ShallowRef<T>
export function shallowRef<T>(value: T): ShallowRef<T>
export function shallowRef<T = any>(): ShallowRef<T | undefined>
export function shallowRef(value?: unknown) {
  return createRef(value, true)
}

/*
 *
 * common
 *
 */
function createRef(rawValue: unknown, shallow: boolean) {
  if (isRef(rawValue)) {
    return rawValue
  }
  return new RefImpl(rawValue, shallow)
}

class RefImpl<T> {
  private _value: T
  public dep?: Dep = undefined
  public readonly __v_isRef = true

  constructor(
    value: T,
    public readonly __v_isShallow: boolean,
  ) {
    this._value = __v_isShallow ? value : toReactive(value)
  }

  get value() {
    trackRefValue(this)
    return this._value
  }

  set value(newVal) {
    this._value = this.__v_isShallow ? newVal : toReactive(newVal)
    triggerRefValue(this)
  }
}

export function triggerRef(ref: Ref) {
  triggerRefValue(ref)
}

export type ToRef<T> = IfAny<T, Ref<T>, [T] extends [Ref] ? T : Ref<T>>
export function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K,
): ToRef<T[K]>
export function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K,
  defaultValue: T[K],
): ToRef<Exclude<T[K], undefined>>
export function toRef(
  source: Record<string, any>,
  key?: string,
  defaultValue?: unknown,
): Ref {
  return propertyToRef(source, key!, defaultValue)
}

function propertyToRef(
  source: Record<string, any>,
  key: string,
  defaultValue?: unknown,
) {
  return new ObjectRefImpl(source, key, defaultValue) as any
}

class ObjectRefImpl<T extends object, K extends keyof T> {
  public readonly __v_isRef = true

  constructor(
    private readonly _object: T,
    private readonly _key: K,
    private readonly _defaultValue?: T[K],
  ) {}

  get value() {
    const val = this._object[this._key]
    return val === undefined ? (this._defaultValue as T[K]) : val
  }

  set value(newVal) {
    this._object[this._key] = newVal
  }

  get dep(): Dep | undefined {
    return getDepFromReactive(this._object, this._key)
  }
}
