import { isObject, toRawType } from '../shared'
import { mutableHandlers } from './baseHandler'
import { mutableCollectionHandlers } from './collectionHandlers'

export const enum ReactiveFlags {
  RAW = '__v_raw',
}

export interface Target {
  [ReactiveFlags.RAW]?: any
}

const enum TargetType {
  INVALID = 0,
  COMMON = 1,
  COLLECTION = 2,
}

function targetTypeMap(rawType: string) {
  switch (rawType) {
    case 'Object':
    case 'Array':
      return TargetType.COMMON
    case 'Map':
    case 'Set':
    case 'WeakMap':
    case 'WeakSet':
      return TargetType.COLLECTION
    default:
      return TargetType.INVALID
  }
}

function getTargetType<T extends object>(value: T) {
  return !Object.isExtensible(value)
    ? TargetType.INVALID
    : targetTypeMap(toRawType(value))
}

export function reactive<T extends object>(target: T): T {
  return createReactiveObject(
    target,
    mutableHandlers,
    mutableCollectionHandlers,
  )
}

function createReactiveObject<T extends object>(
  target: T,
  baseHandlers: ProxyHandler<any>,
  collectionHandlers: ProxyHandler<any>,
) {
  const targetType = getTargetType(target)
  if (targetType === TargetType.INVALID) {
    return target
  }

  const proxy = new Proxy(
    target,
    targetType === TargetType.COLLECTION ? collectionHandlers : baseHandlers,
  )
  return proxy
}

export const toReactive = <T extends unknown>(value: T): T =>
  isObject(value) ? reactive(value) : value

export function toRaw<T>(observed: T): T {
  const raw = observed && (observed as Target)[ReactiveFlags.RAW]
  return raw ? toRaw(raw) : observed
}
