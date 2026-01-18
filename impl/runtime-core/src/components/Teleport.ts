import { ShapeFlags } from "@chibivue/shared";
import type { RendererElement, RendererNode, RendererOptions } from "../renderer";
import type { VNode, VNodeArrayChildren } from "../vnode";
import type { ComponentInternalInstance } from "../component";

export const TeleportSymbol: unique symbol = Symbol();

export interface TeleportProps {
  to: string | RendererElement | null | undefined;
  disabled?: boolean;
}

export const isTeleport = (type: any): boolean => type.__isTeleport;

export interface TeleportImpl {
  __isTeleport: true;
  process: (
    n1: TeleportVNode | null,
    n2: TeleportVNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    internals: TeleportInternals,
  ) => void;
  remove: (vnode: TeleportVNode, internals: TeleportInternals) => void;
  move: typeof moveTeleport;
}

export const Teleport: TeleportImpl = {
  __isTeleport: true,
  process(
    n1: TeleportVNode | null,
    n2: TeleportVNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    internals: TeleportInternals,
  ) {
    const {
      mc: mountChildren,
      pc: patchChildren,
      pbc: patchBlockChildren,
      o: { insert, querySelector, createText, createComment },
    } = internals;

    const disabled = isTeleportDisabled(n2.props);
    const { shapeFlag, children } = n2;

    if (n1 == null) {
      // mount
      const placeholder = (n2.el = createComment("teleport start"));
      const mainAnchor = (n2.anchor = createComment("teleport end"));
      insert(placeholder, container, anchor);
      insert(mainAnchor, container, anchor);

      const target = (n2.target = resolveTarget(n2.props, querySelector));
      const targetAnchor = (n2.targetAnchor = createText(""));

      if (target) {
        insert(targetAnchor, target);
      }

      const mount = (container: RendererElement, anchor: RendererNode | null) => {
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          mountChildren(children as VNodeArrayChildren, container, anchor, parentComponent);
        }
      };

      if (disabled) {
        mount(container, mainAnchor);
      } else if (target) {
        mount(target, targetAnchor);
      }
    } else {
      // update
      n2.el = n1.el;
      const mainAnchor = (n2.anchor = n1.anchor!);
      const target = (n2.target = n1.target!);
      const targetAnchor = (n2.targetAnchor = n1.targetAnchor!);
      const wasDisabled = isTeleportDisabled(n1.props);
      const currentContainer = wasDisabled ? container : target;
      const currentAnchor = wasDisabled ? mainAnchor : targetAnchor;

      patchChildren(n1, n2, currentContainer, currentAnchor, parentComponent);

      if (disabled) {
        if (!wasDisabled) {
          // disabled -> enabled
          moveTeleport(n2, container, mainAnchor, internals, TeleportMoveTypes.TOGGLE);
        }
      } else {
        if (wasDisabled) {
          // enabled -> disabled
          moveTeleport(n2, target, targetAnchor, internals, TeleportMoveTypes.TOGGLE);
        } else if ((n2.props && n2.props.to) !== (n1.props && n1.props.to)) {
          // target changed
          const nextTarget = (n2.target = resolveTarget(n2.props, querySelector));
          if (nextTarget) {
            moveTeleport(n2, nextTarget, null, internals, TeleportMoveTypes.TARGET_CHANGE);
          }
        }
      }
    }
  },

  remove(vnode: TeleportVNode, { um: unmount, o: { remove: hostRemove } }: TeleportInternals) {
    const { shapeFlag, children, anchor, targetAnchor, target } = vnode;
    if (target) {
      hostRemove(targetAnchor!);
    }
    hostRemove(anchor!);
    if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      for (let i = 0; i < (children as VNode[]).length; i++) {
        unmount((children as VNode[])[i]);
      }
    }
  },

  move: moveTeleport,
};

export interface TeleportInternals {
  mc: (
    children: VNodeArrayChildren,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
  ) => void;
  pc: (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
  ) => void;
  pbc: (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
  ) => void;
  um: (vnode: VNode) => void;
  m: (vnode: VNode, container: RendererElement, anchor: RendererNode | null) => void;
  o: RendererOptions;
}

export type TeleportVNode = VNode<RendererNode> & { props: TeleportProps | null };

function isTeleportDisabled(props: TeleportProps | null): boolean {
  return props !== null && !!props.disabled;
}

function resolveTarget<T = RendererElement>(
  props: TeleportProps | null,
  select: RendererOptions["querySelector"],
): T | null {
  const targetSelector = props && props.to;
  if (typeof targetSelector === "string") {
    if (!select) {
      return null;
    } else {
      const target = select(targetSelector);
      return target as T;
    }
  } else {
    return targetSelector as T | null;
  }
}

export const enum TeleportMoveTypes {
  TARGET_CHANGE,
  TOGGLE,
  REORDER,
}

function moveTeleport(
  vnode: TeleportVNode,
  container: RendererElement,
  parentAnchor: RendererNode | null,
  { o: { insert }, m: move }: TeleportInternals,
  moveType: TeleportMoveTypes = TeleportMoveTypes.REORDER,
): void {
  if (moveType === TeleportMoveTypes.TARGET_CHANGE) {
    insert(vnode.targetAnchor!, container, parentAnchor);
  }

  const { el, anchor, shapeFlag, children } = vnode;
  const isReorder = moveType === TeleportMoveTypes.REORDER;
  if (isReorder) {
    insert(el!, container, parentAnchor);
  }
  if (!isReorder || isTeleportDisabled(vnode.props)) {
    if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      for (let i = 0; i < (children as VNode[]).length; i++) {
        move((children as VNode[])[i], container, parentAnchor);
      }
    }
  }
  if (isReorder) {
    insert(anchor!, container, parentAnchor);
  }
}
