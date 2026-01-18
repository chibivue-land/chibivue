import { ShapeFlags } from "../shared/shapeFlags";
import type { ComponentInternalInstance } from "./component";
import { type VNode, Text, Comment, Fragment, normalizeVNode } from "./vnode";

export interface HydrateOptions {
  patchProp: (el: Element, key: string, prevValue: any, nextValue: any) => void;
  nextSibling: (node: Node) => Node | null;
}

export function createHydrationRenderer(options: HydrateOptions) {
  const { patchProp, nextSibling } = options;

  function hydrate(vnode: VNode, container: Element): void {
    const node = container.firstChild;
    if (node) {
      hydrateNode(node, vnode, null);
    }
  }

  function hydrateNode(
    node: Node,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
  ): Node | null {
    const { type, shapeFlag } = vnode;
    vnode.el = node;

    if (type === Text) {
      return nextSibling(node);
    } else if (type === Comment) {
      return nextSibling(node);
    } else if (type === Fragment) {
      return hydrateFragment(node, vnode, parentComponent);
    } else if (shapeFlag & ShapeFlags.ELEMENT) {
      return hydrateElement(node as Element, vnode, parentComponent);
    }

    return nextSibling(node);
  }

  function hydrateElement(
    el: Element,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
  ): Node | null {
    vnode.el = el;

    const { props, children, shapeFlag } = vnode;

    // Attach event handlers during hydration
    if (props) {
      for (const key in props) {
        if (key.startsWith("on") && typeof props[key] === "function") {
          patchProp(el, key, null, props[key]);
        }
      }
    }

    // Hydrate children
    if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      hydrateChildren(el.firstChild, children as VNode[], parentComponent);
    }

    return nextSibling(el);
  }

  function hydrateChildren(
    node: Node | null,
    children: VNode[],
    parentComponent: ComponentInternalInstance | null,
  ): Node | null {
    for (let i = 0; i < children.length; i++) {
      const child = normalizeVNode(children[i]);
      if (node) {
        node = hydrateNode(node, child, parentComponent);
      }
    }
    return node;
  }

  function hydrateFragment(
    node: Node,
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
  ): Node | null {
    vnode.el = node;
    let current = nextSibling(node);
    const children = vnode.children as VNode[];

    if (children && children.length > 0) {
      current = hydrateChildren(current, children, parentComponent);
    }

    vnode.anchor = current;
    return current ? nextSibling(current) : null;
  }

  return { hydrate };
}
