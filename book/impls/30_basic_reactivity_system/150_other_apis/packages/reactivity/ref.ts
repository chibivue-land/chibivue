import { IfAny, isArray } from '../shared'
import { CollectionTypes } from './collectionHandlers'
import { Dep, createDep } from './dep'
import { getDepFromReactive, trackEffects, triggerEffects } from './effect'
import { ShallowReactiveMarker, toReactive } from './reactive'

declare const RefSymbol: unique symbol
export declare const RawSymbol: unique symbol

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
 * ref common
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

export type MaybeRef<T = any> = T | Ref<T>
export type MaybeRefOrGetter<T = any> = MaybeRef<T> | (() => T)
export function unref<T>(ref: MaybeRef<T>): T {
  return isRef(ref) ? ref.value : ref
}

/*
 *
 * custom ref
 *
 */
export type CustomRefFactory<T> = (
  track: () => void,
  trigger: () => void,
) => {
  get: () => T
  set: (value: T) => void
}

class CustomRefImpl<T> {
  public dep?: Dep = undefined
  private readonly _get: ReturnType<CustomRefFactory<T>>['get']
  private readonly _set: ReturnType<CustomRefFactory<T>>['set']
  public readonly __v_isRef = true

  constructor(factory: CustomRefFactory<T>) {
    const { get, set } = factory(
      () => trackRefValue(this),
      () => triggerRefValue(this),
    )
    this._get = get
    this._set = set
  }

  get value() {
    return this._get()
  }

  set value(newVal) {
    this._set(newVal)
  }
}

export function customRef<T>(factory: CustomRefFactory<T>): Ref<T> {
  return new CustomRefImpl(factory) as any
}
/*
 *
 * toRef
 *
 */
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

/*
 *
 * toRefs
 *
 */
export type ToRefs<T = any> = {
  [K in keyof T]: ToRef<T[K]>
}
export function toRefs<T extends object>(object: T): ToRefs<T> {
  const ret: any = isArray(object) ? new Array(object.length) : {}
  for (const key in object) {
    ret[key] = propertyToRef(object, key)
  }
  return ret
}

/*
 *
 * common (to ref)
 *
 */
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

type BaseTypes = string | number | boolean
export interface RefUnwrapBailTypes {}

export type UnwrapRef<T> = T extends ShallowRef<infer V>
  ? V
  : T extends Ref<infer V>
    ? UnwrapRefSimple<V>
    : UnwrapRefSimple<T>

export type UnwrapRefSimple<T> = T extends
  | Function
  | CollectionTypes
  | BaseTypes
  | Ref
  | RefUnwrapBailTypes[keyof RefUnwrapBailTypes]
  | { [RawSymbol]?: true }
  ? T
  : T extends ReadonlyArray<any>
    ? { [K in keyof T]: UnwrapRefSimple<T[K]> }
    : T extends object & { [ShallowReactiveMarker]?: never }
      ? {
          [P in keyof T]: P extends symbol ? T[P] : UnwrapRef<T[P]>
        }
      : T
