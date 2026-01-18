# Hydration

## What is Hydration?

In the previous chapter, we learned how to render Vue components to HTML strings using `renderToString`. However, SSR-generated HTML is just static markup—event handlers and reactivity don't work.

Hydration is the process of "activating" server-generated HTML to function as a client-side Vue application.

<KawaikoNote variant="question" title="Why 'hydration'?">

The name "hydration" comes from the image of "breathing life" into static HTML.
Just like a dried plant comes alive when given water, we inject event handlers and reactivity into static HTML.

</KawaikoNote>

## Difference from Normal Mounting

### Normal `createApp`

```
1. Generate VNode
2. Create new DOM elements
3. Insert DOM into container
```

### `createSSRApp` (Hydration)

```
1. Generate VNode
2. Traverse existing DOM elements
3. Associate VNode with DOM elements
4. Attach event handlers
```

<KawaikoNote variant="funny" title="The essence of Hydration">

Hydration can be thought of as "rendering without creating DOM."
Since the DOM already exists, we just need to associate it with VNodes.

</KawaikoNote>

## Type Definitions

### HydrateOptions

Defines the options needed for Hydration.

```ts
// runtime-core/hydration.ts
export interface HydrateOptions {
  patchProp: (el: Element, key: string, prevValue: any, nextValue: any) => void;
  nextSibling: (node: Node) => Node | null;
}
```

- `patchProp`: Function to attach properties (especially event handlers) to DOM elements
- `nextSibling`: Function to traverse the DOM tree

## createHydrationRenderer Implementation

### Basic Structure

```ts
// runtime-core/hydration.ts
export function createHydrationRenderer(options: HydrateOptions) {
  const { patchProp, nextSibling } = options;

  function hydrate(vnode: VNode, container: Element): void {
    const node = container.firstChild;
    if (node) {
      hydrateNode(node, vnode, null);
    }
  }

  // ... other functions

  return { hydrate };
}
```

The `hydrate` function starts from the container's first child node and traverses the VNode tree and DOM tree in parallel.

### hydrateNode - Branching by Node Type

```ts
function hydrateNode(
  node: Node,
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null,
): Node | null {
  const { type, shapeFlag } = vnode;

  // Important: Associate VNode with DOM element
  vnode.el = node;

  if (type === Text) {
    // Text node: return next sibling
    return nextSibling(node);
  } else if (type === Comment) {
    // Comment node: return next sibling
    return nextSibling(node);
  } else if (type === Fragment) {
    // Fragment: special handling
    return hydrateFragment(node, vnode, parentComponent);
  } else if (shapeFlag & ShapeFlags.ELEMENT) {
    // HTML element: process children too
    return hydrateElement(node as Element, vnode, parentComponent);
  }

  return nextSibling(node);
}
```

Key points:
- `vnode.el = node` is the most important operation. This allows subsequent updates to reference the correct DOM element
- Each function returns "the next DOM node to process"

### hydrateElement - Hydrating HTML Elements

```ts
function hydrateElement(
  el: Element,
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null,
): Node | null {
  vnode.el = el;

  const { props, children, shapeFlag } = vnode;

  // Attach event handlers
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
```

<KawaikoNote variant="warning" title="Only attach event handlers">

During Hydration, we only process event handlers (props starting with `on`).
Attributes like `class` or `style` are already included in the HTML from SSR, so they don't need to be attached.

</KawaikoNote>

### hydrateChildren - Processing Children

```ts
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
```

Processes VNode children and DOM child nodes in order. Each `hydrateNode` returns the next sibling node, which is used to continue traversal.

### hydrateFragment - Fragment Handling

In SSR, Fragments are rendered wrapped in `<!--[-->` and `<!--]-->` comment nodes.

```ts
function hydrateFragment(
  node: Node,
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null,
): Node | null {
  // Set the start comment (<!--[-->) to el
  vnode.el = node;

  // Children start after the start comment
  let current = nextSibling(node);
  const children = vnode.children as VNode[];

  if (children && children.length > 0) {
    current = hydrateChildren(current, children, parentComponent);
  }

  // Set the end comment (<!--]-->) to anchor
  vnode.anchor = current;
  return current ? nextSibling(current) : null;
}
```

```html
<!-- SSR output example -->
<!--[-->
<p>Item 1</p>
<p>Item 2</p>
<p>Item 3</p>
<!--]-->
```

## createSSRApp Implementation

`createSSRApp` is almost the same as regular `createApp`, but performs Hydration during mount.

```ts
// runtime-dom/index.ts

// Create Hydration renderer
const { hydrate: hydrateVNode } = createHydrationRenderer({
  patchProp,
  nextSibling: nodeOps.nextSibling,
});

export const createSSRApp = ((...args) => {
  const app = _createApp(...args);
  const { mount } = app;

  app.mount = (selector: string) => {
    const container = document.querySelector(selector);
    if (!container) return;

    // Check if container has SSR content
    if (container.hasChildNodes()) {
      // Execute Hydration
      const proxy = mount(container, true /* isHydrate */);
      return proxy;
    } else {
      // If no SSR content, normal mount
      mount(container);
    }
  };

  return app;
}) as CreateAppFunction<Element>;
```

## Processing Flow

```
[Server side]
renderToString(app)
  ↓
<div id="app">
  <button>Count: 0</button>
</div>

[Client side]
createSSRApp(App).mount('#app')
  ↓
container.hasChildNodes() → true
  ↓
hydrate(vnode, container)
  ↓
hydrateNode(button, vnode)
  ├── vnode.el = button  ← Associate VNode with DOM
  └── patchProp(button, 'onClick', null, handler)  ← Attach event
  ↓
Clicking the button triggers reactivity
```

## Usage Example

### Server-side

```ts
// server.ts
import { createApp } from '@chibivue/runtime-dom'
import { renderToString } from '@chibivue/server-renderer'
import App from './App.vue'

const app = createApp(App)
const html = await renderToString(app)

// Send HTML to client
res.send(`
  <!DOCTYPE html>
  <html>
    <body>
      <div id="app">${html}</div>
      <script src="/client.js"></script>
    </body>
  </html>
`)
```

### Client-side

```ts
// client.ts
import { createSSRApp } from '@chibivue/runtime-dom'
import App from './App.vue'

// Use createSSRApp (not createApp)
const app = createSSRApp(App)
app.mount('#app')
```

### App Component

```vue
<!-- App.vue -->
<script setup>
import { ref } from '@chibivue/runtime-core'

const count = ref(0)
const increment = () => count.value++
</script>

<template>
  <button @click="increment">Count: {{ count }}</button>
</template>
```

## Hydration Mismatch

During Hydration, the HTML generated by SSR must match the VNode generated on the client. If they don't match, a "Hydration mismatch" occurs.

### Common Causes

1. **Date/random numbers**: `new Date()` or `Math.random()` produce different values on server and client
2. **Browser-specific APIs**: `window` or `localStorage` don't exist on the server
3. **Conditional branches**: Different code paths are taken on server and client

### Solutions

```vue
<script setup>
import { ref, onMounted } from '@chibivue/runtime-core'

// Same initial value on server and client
const clientOnly = ref(false)

// Update only on client side
onMounted(() => {
  clientOnly.value = true
})
</script>

<template>
  <div v-if="clientOnly">
    This content is only shown on client
  </div>
</template>
```

<KawaikoNote variant="warning" title="Watch out for mismatches!">

When a Hydration mismatch occurs, Vue will warn, and in the worst case, the DOM may break.
Be careful to ensure server and client produce the same output.

</KawaikoNote>

## Future Extensions

The current implementation is minimal, but Vue itself has features like:

1. **Hydration mismatch detection**: Detect server/client inconsistencies in development mode
2. **Partial Hydration**: Hydrate only necessary parts (performance optimization)
3. **Optimization with PatchFlags**: Skip Hydration for static nodes
4. **Async component Hydration**: Integration with `Suspense`

<KawaikoNote variant="surprise" title="Hydration complete!">

Now we have all the pieces for SSR.
By using `renderToString` for server-side rendering and
`createSSRApp` for Hydration,
we can achieve a complete SSR application.

</KawaikoNote>

## Summary

The Hydration implementation consists of:

1. **createHydrationRenderer**: Creates a renderer for Hydration
2. **hydrateNode**: Branches processing based on VNode type
3. **hydrateElement**: HTML elements and event handler attachment
4. **hydrateChildren**: Recursive processing of children
5. **hydrateFragment**: Processing Fragments (areas enclosed by comment nodes)
6. **createSSRApp**: Application factory with Hydration support

The essence of Hydration is "associating VNodes with existing DOM without recreating it." This enables both the fast initial display of SSR and the rich interactivity of SPAs.
