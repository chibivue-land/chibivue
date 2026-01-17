import { isObject } from "../shared";
import { mutableHandlers } from "./baseHandler";

export function reactive<T extends object>(target: T): T {
  const proxy = new Proxy(target, mutableHandlers);
  return proxy as T;
}

export const toReactive = <T extends unknown>(value: T): T =>
  isObject(value) ? reactive(value) : value;
