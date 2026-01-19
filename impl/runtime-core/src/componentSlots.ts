import { toRaw } from "@chibivue/reactivity";
import type { IfAny, Prettify } from "@chibivue/shared";
import type { ComponentInternalInstance } from "./component";
import type { VNode, VNodeNormalizedChildren } from "./vnode";

export type Slot<T extends any = any> = (
  ...args: IfAny<T, any[], [T] | (T extends undefined ? [] : never)>
) => VNode[];

export type InternalSlots = {
  [name: string]: Slot | undefined;
};

export type Slots = Readonly<InternalSlots>;

declare const SlotSymbol: unique symbol;
export type SlotsType<T extends Record<string, any> = Record<string, any>> = {
  [SlotSymbol]?: T;
};

export type RawSlots = {
  [name: string]: unknown;
};

export type UnwrapSlotsType<S extends SlotsType, T = NonNullable<S[typeof SlotSymbol]>> = [
  keyof S,
] extends [never]
  ? Slots
  : Readonly<
      Prettify<{
        [K in keyof T]: NonNullable<T[K]> extends (...args: any[]) => any ? T[K] : Slot<T[K]>;
      }>
    >;

export const initSlots = (
  instance: ComponentInternalInstance,
  children: VNodeNormalizedChildren,
): void => {
  if (children === null || children === undefined) {
    instance.slots = {};
  } else if (Array.isArray(children)) {
    // Array children should be converted to a default slot function
    instance.slots = {
      default: () => children as VNode[],
    };
  } else if (typeof children === "object") {
    // Already an object with slot functions
    instance.slots = toRaw(children as InternalSlots);
  } else {
    instance.slots = {};
  }
};

export const updateSlots = (
  instance: ComponentInternalInstance,
  children: VNodeNormalizedChildren,
): void => {
  if (children === null || children === undefined) {
    instance.slots = {};
  } else if (Array.isArray(children)) {
    // Array children should be converted to a default slot function
    instance.slots = {
      default: () => children as VNode[],
    };
  } else if (typeof children === "object") {
    // Already an object with slot functions
    instance.slots = toRaw(children as InternalSlots);
  } else {
    instance.slots = {};
  }
};
