import { hasChanged, hasOwn, isMap } from '../shared'
import { ITERATE_KEY, track, trigger } from './effect'
import { ReactiveFlags, toRaw, toReactive } from './reactive'

export type CollectionTypes = IterableCollections | WeakCollections

type IterableCollections = Map<any, any> | Set<any>
type WeakCollections = WeakMap<any, any> | WeakSet<any>
type MapTypes = Map<any, any> | WeakMap<any, any>
type SetTypes = Set<any> | WeakSet<any>

const getProto = <T extends CollectionTypes>(v: T): any =>
  Reflect.getPrototypeOf(v)

function get(target: MapTypes, key: unknown) {
  target = (target as any)[ReactiveFlags.RAW]
  const rawTarget = toRaw(target)
  const rawKey = toRaw(key)
  track(rawTarget, rawKey)

  const { has } = getProto(rawTarget)
  if (has.call(rawTarget, rawKey)) {
    return toReactive(target.get(key))
  } else if (has.call(rawTarget, rawKey)) {
    return toReactive(target.get(rawKey))
  } else if (target !== rawTarget) {
    target.get(key)
  }
}

function has(this: CollectionTypes, key: unknown): boolean {
  const target = (this as any)[ReactiveFlags.RAW]
  const rawTarget = toRaw(target)
  const rawKey = toRaw(key)
  track(rawTarget, rawKey)
  return target.has(key) || target.has(rawKey)
}

function size(target: IterableCollections) {
  target = (target as any)[ReactiveFlags.RAW]
  track(target, ITERATE_KEY)
  return Reflect.get(toRaw(target), 'size', target)
}

function add(this: SetTypes, value: unknown) {
  value = toRaw(value)
  const target = toRaw(this)

  const proto = getProto(target)
  const hadKey = proto.has.call(target, value)
  if (!hadKey) {
    target.add(value)
    trigger(target, ITERATE_KEY)
  }
  return this
}

function set(this: MapTypes, key: unknown, value: unknown) {
  value = toRaw(value)
  const target = toRaw(this)

  const { has, get } = getProto(target)
  let hadKey = has.call(target, key)
  if (!hadKey) hadKey = has.call(target, key)

  const oldValue = get.call(target, key)
  target.set(key, value)
  if (!hadKey) {
    trigger(target, ITERATE_KEY)
  } else if (hasChanged(value, oldValue)) {
    trigger(target, ITERATE_KEY)
  }
  return this
}

function deleteEntry(this: CollectionTypes, key: unknown) {
  const target = toRaw(this)
  const { has } = getProto(target)
  let hadKey = has.call(target, key)
  if (!hadKey) hadKey = has.call(target, key)
  const result = target.delete(key)
  if (hadKey) trigger(target, key)
  return result
}

function clear(this: IterableCollections) {
  const target = toRaw(this)
  const hadItems = target.size !== 0
  const result = target.clear()
  if (hadItems) trigger(target)
  return result
}

function createForEach() {
  return function forEach(
    this: IterableCollections,
    callback: Function,
    thisArg?: unknown,
  ) {
    const observed = this as any
    const target = observed[ReactiveFlags.RAW]
    const rawTarget = toRaw(target)
    track(rawTarget, ITERATE_KEY)
    return target.forEach((value: unknown, key: unknown) => {
      return callback.call(
        thisArg,
        toReactive(value),
        toReactive(key),
        observed,
      )
    })
  }
}

interface Iterable {
  [Symbol.iterator](): Iterator
}

interface Iterator {
  next(value?: any): IterationResult
}

interface IterationResult {
  value: any
  done: boolean
}

function createIterableMethod(method: string | symbol) {
  return function (
    this: IterableCollections,
    ...args: unknown[]
  ): Iterable & Iterator {
    const target = (this as any)[ReactiveFlags.RAW]
    const rawTarget = toRaw(target)
    const targetIsMap = isMap(rawTarget)
    const isPair =
      method === 'entries' || (method === Symbol.iterator && targetIsMap)
    const innerIterator = target[method](...args)
    track(rawTarget, ITERATE_KEY)
    return {
      next() {
        const { value, done } = innerIterator.next()
        return done
          ? { value, done }
          : {
              value: isPair
                ? [toReactive(value[0]), toReactive(value[1])]
                : toReactive(value),
              done,
            }
      },
      [Symbol.iterator]() {
        return this
      },
    }
  }
}

function createInstrumentations() {
  const mutableInstrumentations: Record<string, Function | number> = {
    get(this: MapTypes, key: unknown) {
      return get(this, key)
    },
    get size() {
      return size(this as unknown as IterableCollections)
    },
    has,
    add,
    set,
    delete: deleteEntry,
    clear,
    forEach: createForEach(),
  }

  const iteratorMethods = ['keys', 'values', 'entries', Symbol.iterator]
  iteratorMethods.forEach(method => {
    mutableInstrumentations[method as string] = createIterableMethod(method)
  })

  return { mutableInstrumentations }
}

function createInstrumentationGetter() {
  return (
    target: CollectionTypes,
    key: string | symbol,
    receiver: CollectionTypes,
  ) => {
    const { mutableInstrumentations } = createInstrumentations()

    if (key === ReactiveFlags.RAW) {
      return target
    }

    return Reflect.get(
      hasOwn(mutableInstrumentations, key) && key in target
        ? mutableInstrumentations
        : target,
      key,
      receiver,
    )
  }
}

export const mutableCollectionHandlers: ProxyHandler<CollectionTypes> = {
  get: createInstrumentationGetter(),
}
