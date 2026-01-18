# Vapor Mode

## What is Vapor Mode?

Vapor Mode is a new compilation strategy for Vue.js that improves performance by performing direct DOM operations without using the virtual DOM.

In traditional Vue.js, when a component's state changes, the virtual DOM is regenerated, diffing is performed, and the actual DOM is updated. In Vapor Mode, this virtual DOM overhead is eliminated, and only the necessary DOM operations are executed directly when reactive values change.

## Detailed Resources

For detailed explanations of Vapor Mode, please refer to the following repository:

**[reading-vuejs-core-vapor](https://github.com/ubugeeei/reading-vuejs-core-vapor)**

This repository provides in-depth explanations of Vue.js Vapor Mode's internal implementation.

## Vapor Implementation in chibivue

chibivue provides a minimal Vapor implementation in the `runtime-vapor` package.
Let's look at a simple implementation to understand the basic concepts.

### Basic Ideas

The core of Vapor Mode consists of two points:

1. **Convert templates directly to DOM**: Generate actual DOM elements instead of virtual DOM nodes
2. **Reflect reactive value changes directly to DOM**: Update only the changed parts without diffing

### The template Function

First, let's look at the `template` function that creates DOM elements from HTML strings:

```ts
export type VaporNode = Element & { __is_vapor: true };

export const template = (tmp: string): VaporNode => {
  const container = document.createElement("div");
  container.innerHTML = tmp;
  const el = container.firstElementChild as VaporNode;
  el.__is_vapor = true;
  return el;
};
```

This function receives an HTML string and returns an actual DOM element. It directly manipulates the DOM without going through the virtual DOM.

### The setText Function

The `setText` function updates text content:

```ts
export const setText = (
  target: Element,
  format: string,
  ...values: any[]
): void => {
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
```

This function is called when reactive values change, directly updating the DOM's text content.

### The on Function

The `on` function registers event listeners:

```ts
export const on = (
  element: Element,
  event: string,
  callback: () => void
): void => {
  element.addEventListener(event, callback);
};
```

### Vapor Components

Components in Vapor Mode take a different form from regular Vue components:

```ts
export type VaporComponent = (self: VaporComponentInternalInstance) => VaporNode;

export interface VaporComponentInternalInstance {
  __is_vapor: true;
  uid: number;
  type: VaporComponent;
  parent: ComponentInternalInstance | VaporComponentInternalInstance | null;
  appContext: AppContext;
  provides: Data;
  isMounted: boolean;
  // Lifecycle hooks
  [LifecycleHooks.BEFORE_MOUNT]: LifecycleHook;
  [LifecycleHooks.MOUNTED]: LifecycleHook;
  // ...
}
```

A Vapor component is a function that receives an instance and returns a VaporNode (an actual DOM element).

### Comparison of Compilation Results

Traditional virtual DOM-based compilation result:

```ts
// Input: <div>{{ count }}</div>
// Virtual DOM output
function render(_ctx) {
  return h("div", null, _ctx.count);
}
```

Vapor Mode compilation result:

```ts
// Input: <div>{{ count }}</div>
// Vapor output
const t0 = template("<div></div>");

function render(_ctx) {
  const el = t0();
  effect(() => {
    setText(el, _ctx.count);
  });
  return el;
}
```

In Vapor Mode:
- Templates are pre-generated as DOM elements (using the `template` function)
- Reactive value updates directly manipulate the DOM within `effect`
- There is no cost for virtual DOM generation and diffing

## Summary

Vapor Mode is a new approach that improves performance by eliminating virtual DOM overhead. The `runtime-vapor` package in chibivue provides a minimal implementation of this concept.

For more detailed implementations and Vue.js's official Vapor Mode, please refer to [reading-vuejs-core-vapor](https://github.com/ubugeeei/reading-vuejs-core-vapor).
