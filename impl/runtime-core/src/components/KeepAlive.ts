import { ShapeFlags, isArray, isString } from "@chibivue/shared";
import type { ComponentInternalInstance, Data } from "../component";
import { getCurrentInstance } from "../component";
import type { VNode } from "../vnode";
import { cloneVNode, isSameVNodeType } from "../vnode";
import { queuePostFlushCb } from "../scheduler";
import { setCurrentInstance, unsetCurrentInstance } from "../component";

export interface KeepAliveProps {
  include?: MatchPattern;
  exclude?: MatchPattern;
  max?: number | string;
}

type MatchPattern = string | RegExp | (string | RegExp)[];

export interface KeepAliveContext extends ComponentInternalInstance {
  renderer: KeepAliveRenderer;
  activate: (
    vnode: VNode,
    container: any,
    anchor: any | null,
    parentComponent: ComponentInternalInstance | null,
  ) => void;
  deactivate: (vnode: VNode) => void;
}

interface KeepAliveRenderer {
  p: (
    n1: VNode | null,
    n2: VNode,
    container: any,
    anchor: any | null,
    parentComponent: ComponentInternalInstance | null,
  ) => void;
  m: (vnode: VNode, container: any, anchor: any | null) => void;
  um: (vnode: VNode) => void;
  o: {
    createElement: (type: string) => any;
  };
}

const KeepAliveImpl = {
  name: `KeepAlive`,
  __isKeepAlive: true,
  props: {
    include: [String, RegExp, Array],
    exclude: [String, RegExp, Array],
    max: [String, Number],
  },
  setup(props: KeepAliveProps, { slots }: { slots: any }) {
    const instance = getCurrentInstance()! as KeepAliveContext;
    const cache: Map<any, VNode> = new Map();
    const keys: Set<any> = new Set();
    let current: VNode | null = null;

    const parentComponent = instance.parent as ComponentInternalInstance;

    // Create a hidden container for holding deactivated components
    const storageContainer = instance.renderer.o.createElement("div");

    instance.activate = (vnode, container, anchor, _parentComponent) => {
      const instance = vnode.component!;
      move(vnode, container, anchor);
      // in case props have changed
      patch(instance.vnode, vnode, container, anchor, parentComponent);
      queuePostFlushCb(() => {
        instance.isDeactivated = false;
        if (instance.a) {
          instance.a.forEach((hook: () => void) => hook());
        }
      });
    };

    instance.deactivate = (vnode: VNode) => {
      move(vnode, storageContainer, null);
      queuePostFlushCb(() => {
        const instance = vnode.component!;
        if (instance.da) {
          instance.da.forEach((hook: () => void) => hook());
        }
        instance.isDeactivated = true;
      });
    };

    function move(vnode: VNode, container: any, anchor: any | null): void {
      instance.renderer.m(vnode, container, anchor);
    }

    function patch(
      n1: VNode | null,
      n2: VNode,
      container: any,
      anchor: any | null,
      parentComponent: ComponentInternalInstance | null,
    ): void {
      instance.renderer.p(n1, n2, container, anchor, parentComponent);
    }

    function unmount(vnode: VNode): void {
      resetShapeFlag(vnode);
      instance.renderer.um(vnode);
    }

    function pruneCache(filter?: (name: string) => boolean): void {
      cache.forEach((vnode, key) => {
        const name = getComponentName(vnode.type as any);
        if (name && (!filter || !filter(name))) {
          pruneCacheEntry(key);
        }
      });
    }

    function pruneCacheEntry(key: any): void {
      const cached = cache.get(key) as VNode;
      if (!current || !isSameVNodeType(cached, current)) {
        unmount(cached);
      } else if (current) {
        resetShapeFlag(current);
      }
      cache.delete(key);
      keys.delete(key);
    }

    return (): VNode | undefined => {
      if (!slots.default) {
        return undefined;
      }

      const children = slots.default();
      const rawVNode = children[0];
      if (children.length > 1) {
        current = null;
        return children as unknown as VNode;
      } else if (
        !(rawVNode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) &&
        !(rawVNode.shapeFlag & ShapeFlags.COMPONENT)
      ) {
        current = null;
        return rawVNode;
      }

      let vnode = rawVNode;
      const comp = vnode.type as any;
      const name = getComponentName(comp);
      const { include, exclude, max } = props;

      if (
        (include && (!name || !matches(include, name))) ||
        (exclude && name && matches(exclude, name))
      ) {
        current = vnode;
        return rawVNode;
      }

      const key = vnode.key == null ? comp : vnode.key;
      const cachedVNode = cache.get(key);

      if (cachedVNode) {
        vnode.el = cachedVNode.el;
        vnode.component = cachedVNode.component;
        vnode.shapeFlag |= ShapeFlags.COMPONENT_KEPT_ALIVE;
        keys.delete(key);
        keys.add(key);
      } else {
        keys.add(key);
        if (max && keys.size > parseInt(max as string, 10)) {
          pruneCacheEntry(keys.values().next().value);
        }
      }

      vnode.shapeFlag |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE;
      current = vnode;
      return vnode;
    };
  },
};

export const KeepAlive = KeepAliveImpl as any as {
  __isKeepAlive: true;
  new (): {
    $props: KeepAliveProps;
  };
};

export function isKeepAlive(vnode: VNode): boolean {
  return (vnode.type as any).__isKeepAlive === true;
}

function matches(pattern: MatchPattern, name: string): boolean {
  if (isArray(pattern)) {
    return pattern.some((p: string | RegExp) => matches(p, name));
  } else if (isString(pattern)) {
    return pattern.split(",").includes(name);
  } else if (pattern instanceof RegExp) {
    return pattern.test(name);
  }
  return false;
}

function resetShapeFlag(vnode: VNode): void {
  vnode.shapeFlag &= ~ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE;
  vnode.shapeFlag &= ~ShapeFlags.COMPONENT_KEPT_ALIVE;
}

function getComponentName(comp: { name?: string; __name?: string }): string | undefined {
  return comp.name || comp.__name;
}
