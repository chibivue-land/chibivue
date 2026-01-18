import { Fragment, type VNode, createVNode } from "../vnode";
import type { Slots } from "../componentSlots";

export function renderSlot(slots: Slots, name: string): VNode {
  let slot = slots[name];
  if (!slot) {
    slot = () => [];
  }

  return createVNode(Fragment, {}, slot());
}
