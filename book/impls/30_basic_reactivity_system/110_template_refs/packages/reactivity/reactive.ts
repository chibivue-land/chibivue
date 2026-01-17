import { isObject, toRawType } from "../shared";
import { mutableHandlers } from "./baseHandler";

const enum TargetType {
  INVALID = 0,
  COMMON = 1,
}

function targetTypeMap(rawType: string) {
  switch (rawType) {
    case "Object":
    case "Array":
      return TargetType.COMMON;
    default:
      return TargetType.INVALID;
  }
}

function getTargetType<T extends object>(value: T) {
  return !Object.isExtensible(value) ? TargetType.INVALID : targetTypeMap(toRawType(value));
}

export function reactive<T extends object>(target: T): T {
  const targetType = getTargetType(target);
  if (targetType === TargetType.INVALID) {
    return target;
  }

  const proxy = new Proxy(target, mutableHandlers);
  return proxy as T;
}

export const toReactive = <T extends unknown>(value: T): T =>
  isObject(value) ? reactive(value) : value;
