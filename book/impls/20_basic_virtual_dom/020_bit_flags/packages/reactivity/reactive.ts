import { mutableHandlers } from "./baseHandler";

export function reactive<T extends object>(target: T): T {
  const proxy = new Proxy(target, mutableHandlers);
  return proxy as T;
}
