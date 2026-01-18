import type { RootRenderFunction, VNode } from "@chibivue/runtime-core";
import { createRenderer, LifecycleHooks } from "@chibivue/runtime-core";
import { nodeOps, patchProp } from "@chibivue/runtime-dom";
import { effect, getCurrentScope, EffectScope } from "@chibivue/reactivity";
import { invokeArrayFns } from "@chibivue/shared";

import type { VaporComponentInternalInstance } from "./component";

export * from "./component";

export type VaporNode = Element & { __is_vapor: true };

// Current Vapor component instance being rendered
let currentInstance: VaporComponentInternalInstance | null = null;

export const setCurrentVaporInstance = (instance: VaporComponentInternalInstance | null): void => {
  currentInstance = instance;
};

export const getCurrentVaporInstance = (): VaporComponentInternalInstance | null => {
  return currentInstance;
};

export const template = (tmp: string): VaporNode => {
  const container = document.createElement("div");
  container.innerHTML = tmp;
  const el = container.firstElementChild as VaporNode;
  el.__is_vapor = true;
  return el;
};

/**
 * renderEffect - Core mechanism for reactive DOM updates in Vapor mode
 *
 * Unlike Virtual DOM's diff-based approach, renderEffect directly tracks
 * reactive dependencies and updates the DOM when they change.
 *
 * How it works:
 * 1. Wraps a DOM update function in a reactive effect
 * 2. Automatically tracks which reactive values are accessed
 * 3. Re-runs the update function when tracked values change
 * 4. Updates only the specific DOM nodes that need changes
 *
 * Important: renderEffect also handles lifecycle hooks:
 * - Calls onBeforeUpdate hooks before each update (after initial mount)
 * - Calls onUpdated hooks after each update (after initial mount)
 *
 * Example generated code:
 *   renderEffect(() => {
 *     setText(el, "", count.value)
 *   })
 *
 * When count.value changes:
 * 1. onBeforeUpdate hooks are called
 * 2. The text content is updated
 * 3. onUpdated hooks are called (in a microtask)
 */
export const renderEffect = (fn: () => void): void => {
  const instance = currentInstance;

  effect(() => {
    // Before update: call onBeforeUpdate hooks (only after mount)
    if (instance?.isMounted) {
      const { bu } = instance as any;
      if (bu) {
        invokeArrayFns(bu);
      }
    }

    // Execute the update
    fn();

    // After update: call onUpdated hooks (only after mount)
    if (instance?.isMounted) {
      const { u } = instance as any;
      if (u) {
        // Queue updated hooks to run after the current microtask
        queueMicrotask(() => {
          invokeArrayFns(u);
        });
      }
    }
  });
};

export const setText = (target: Element, format: string, ...values: any[]): void => {
  const fmt = (): string => {
    let text = format;
    for (let i = 0; i < values.length; i++) {
      text = text.replace("{}", values[i]);
    }
    return text;
  };

  if (!target) return;

  if (!values.length) {
    target.textContent = fmt();
    return;
  }

  if (!format && values.length) {
    target.textContent = values.join("");
    return;
  }

  target.textContent = fmt();
};

export const on = (element: Element, event: string, callback: () => void): void => {
  element.addEventListener(event, callback);
};

export const setClass = (element: Element, value: string | object | any[]): void => {
  if (typeof value === "string") {
    element.className = value;
  } else if (Array.isArray(value)) {
    element.className = value.filter(Boolean).join(" ");
  } else if (typeof value === "object" && value !== null) {
    const classes: string[] = [];
    for (const [key, val] of Object.entries(value)) {
      if (val) classes.push(key);
    }
    element.className = classes.join(" ");
  }
};

export const setStyle = (
  element: Element,
  value: string | Record<string, string | number>,
): void => {
  const el = element as HTMLElement;
  if (typeof value === "string") {
    el.style.cssText = value;
  } else if (typeof value === "object" && value !== null) {
    for (const [key, val] of Object.entries(value)) {
      el.style.setProperty(
        key.startsWith("--") ? key : key.replace(/([A-Z])/g, "-$1").toLowerCase(),
        typeof val === "number" ? `${val}px` : val,
      );
    }
  }
};

export const setAttr = (element: Element, key: string, value: any): void => {
  if (value == null || value === false) {
    element.removeAttribute(key);
  } else {
    element.setAttribute(key, value === true ? "" : String(value));
  }
};

/*
 *
 * for non vapor component
 *
 */

const renderer = createRenderer({ ...nodeOps, patchProp });

const render = ((...args) => renderer.render(...args)) as RootRenderFunction<Element>;

export const createComponent = (
  self: VaporComponentInternalInstance,
  component: VNode,
  container: VaporNode,
): void => render(component, container, self);
