import { isArray, isObject, isString } from "@chibivue/shared";

export function ssrRenderList(
  source: unknown,
  renderItem: (value: unknown, key: string | number, index?: number) => void,
): void {
  if (isArray(source) || isString(source)) {
    for (let i = 0, l = source.length; i < l; i++) {
      renderItem(source[i], i);
    }
  } else if (typeof source === "number") {
    for (let i = 0; i < source; i++) {
      renderItem(i + 1, i);
    }
  } else if (isObject(source)) {
    if (source[Symbol.iterator as any]) {
      const arr = Array.from(source as Iterable<any>);
      for (let i = 0, l = arr.length; i < l; i++) {
        renderItem(arr[i], i);
      }
    } else {
      const keys = Object.keys(source);
      for (let i = 0, l = keys.length; i < l; i++) {
        const key = keys[i];
        renderItem((source as Record<string, unknown>)[key], key, i);
      }
    }
  }
}
