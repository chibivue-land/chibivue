import type { VaporComponentInternalInstance, VaporComponent } from "./component";
import { createVaporComponentInstance } from "./component";
import type { VNode, AppContext } from "@chibivue/runtime-core";
import { setCurrentInstance, unsetCurrentInstance } from "@chibivue/runtime-core";
import { effect } from "@chibivue/reactivity";
import { invokeArrayFns } from "@chibivue/shared";

export interface VaporHydrationContext {
  // Current DOM node being hydrated
  node: Node | null;
  // Parent element
  parent: Element;
}

/**
 * Hydrate a Vapor component against existing SSR-rendered DOM.
 *
 * In Vapor SSR:
 * - Server uses standard VNode SSR (compiler-ssr) to generate HTML
 * - Client uses createVaporSSRApp to hydrate and attach reactivity
 *
 * The hydration process:
 * 1. Find existing DOM elements (rendered by SSR)
 * 2. Execute Vapor component setup logic
 * 3. Attach event listeners
 * 4. Set up reactive effects
 */
export function hydrateVaporComponent(
  vnode: VNode,
  container: Element,
  parentInstance: VaporComponentInternalInstance | null = null,
): VaporComponentInternalInstance {
  const instance = createVaporComponentInstance(vnode, parentInstance);

  // Set up hydration context
  const ctx: VaporHydrationContext = {
    node: container.firstChild,
    parent: container,
  };

  // Execute component with hydration mode
  setCurrentInstance(instance as any);

  // Store hydration context for template() calls
  (instance as any).__hydrationCtx = ctx;

  try {
    const comp = instance.type as VaporComponent;
    // Run the component - in hydration mode, template() will find existing DOM
    const el = comp(instance);

    // Mark as mounted
    instance.isMounted = true;

    // Invoke mounted hooks
    const { m } = instance as any;
    if (m) {
      invokeArrayFns(m);
    }

    return instance;
  } finally {
    unsetCurrentInstance();
    delete (instance as any).__hydrationCtx;
  }
}

/**
 * Hydrate template - find existing DOM element instead of creating new one.
 * This is used during client-side hydration of SSR-rendered Vapor components.
 */
export function hydrateTemplate(ctx: VaporHydrationContext, _html: string): Element {
  // In hydration mode, we don't create new elements
  // Instead, we return the existing SSR-rendered element
  const el = ctx.node as Element;

  // Move to next sibling for subsequent template() calls
  if (el) {
    ctx.node = el.nextSibling;
  }

  return el;
}

/**
 * Hydrate render effect - set up reactive effect using existing DOM.
 * The effect will update the already-hydrated DOM when reactive values change.
 */
export function hydrateRenderEffect(
  instance: VaporComponentInternalInstance,
  fn: () => void,
): void {
  effect(() => {
    // Before update: call onBeforeUpdate hooks (only after mount)
    if (instance.isMounted) {
      const { bu } = instance as any;
      if (bu) {
        invokeArrayFns(bu);
      }
    }

    // Execute the update
    fn();

    // After update: call onUpdated hooks (only after mount)
    if (instance.isMounted) {
      const { u } = instance as any;
      if (u) {
        queueMicrotask(() => {
          invokeArrayFns(u);
        });
      }
    }
  });
}
