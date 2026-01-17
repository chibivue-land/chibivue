import type { VNodeChild } from "../vnode";

export function renderList<T>(
  source: T[],
  renderItem: (value: T, index: number) => VNodeChild,
): VNodeChild[] {
  return source.map(renderItem);
}
