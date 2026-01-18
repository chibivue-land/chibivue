# Vapor SSR

In this section, we'll explore how to render Vapor components on the server side.
SSR (Server-Side Rendering) for Vapor presents unique challenges since Vapor components directly manipulate the DOM, which doesn't exist on the server.

## The Challenge

Vapor components work by:
1. Creating DOM elements using `document.createElement` (via `template()`)
2. Directly manipulating those elements with `textContent`, `addEventListener`, etc.

On the server, there's no `document` object. We need a different approach to generate HTML strings from Vapor components.

## Solution Approach

There are two main approaches to Vapor SSR:

1. **Mock DOM**: Create a fake DOM environment that captures operations and converts them to HTML
2. **Reuse VNode SSR**: Use standard VNode-based SSR on the server, hydrate as Vapor on the client

Vue.js [PR #13226](https://github.com/vuejs/core/pull/13226) adopts the second approach. chibivue implements a similar approach.

<KawaikoNote variant="base" title="Vue.js Approach">
Vue.js Vapor SSR uses the existing VNode-based SSR (compiler-ssr) on the server side, and uses `createVaporSSRApp` for hydration on the client side. This eliminates the need to create a separate SSR compiler.
</KawaikoNote>

## Implementation

### Server-Side: Using VNode SSR

In Vapor SSR, Vapor components are compiled as regular VNode-based components on the server side. This allows `@chibivue/compiler-ssr` to be used directly.

```ts
// compiler-sfc/src/compileTemplate.ts
export function compileTemplate({
  source,
  ssr = false,
  vapor = false,
}: SFCTemplateCompileOptions): SFCTemplateCompileResults {
  // Use compiler-ssr even in Vapor + SSR mode
  const defaultCompiler = ssr
    ? (CompilerSSR as TemplateCompiler)
    : CompilerDOM;

  let { code, ast, preamble } = defaultCompiler.compile(source, {
    ...compilerOptions,
    ssr,
  });

  // Add __vapor flag in Vapor + SSR mode
  if (vapor && ssr) {
    code = code.replace(
      /export (function|const) ssrRender/,
      "export const __vapor = true;\nexport $1 ssrRender",
    );
  }

  return { code, ast, source, preamble };
}
```

The `__vapor` flag indicates that Vapor mode should be used during hydration.

### Client-Side: createVaporSSRApp

On the client side, `createVaporSSRApp` is used to hydrate SSR-rendered HTML.

```ts
// runtime-vapor/src/apiCreateVaporApp.ts
export function createVaporSSRApp(rootComponent: VaporComponent): VaporApp {
  const context = createAppContext();

  const app: VaporApp = {
    // ... common app configuration ...

    mount(containerOrSelector: Element | string) {
      const container = typeof containerOrSelector === "string"
        ? document.querySelector(containerOrSelector)
        : containerOrSelector;

      if (container?.hasChildNodes()) {
        // Hydration mode when SSR content exists
        const vnode = createVNode(rootComponent as any);
        vnode.appContext = context;
        const instance = hydrateVaporComponent(vnode, container, null);
        app._instance = instance;
      } else {
        // Normal mount when no SSR content
        // ...
      }
    },
  };

  return app;
}
```

### Hydration

The hydration process reuses existing DOM elements while setting up reactivity and event listeners.

```ts
// runtime-vapor/src/hydration.ts
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

  setCurrentInstance(instance as any);
  (instance as any).__hydrationCtx = ctx;

  try {
    const comp = instance.type as VaporComponent;
    // Execute component - template() finds existing DOM
    const el = comp(instance);

    // Mark as mounted
    instance.isMounted = true;

    // Invoke mounted hooks
    const { m } = instance as any;
    if (m) invokeArrayFns(m);

    return instance;
  } finally {
    unsetCurrentInstance();
    delete (instance as any).__hydrationCtx;
  }
}
```

## Mock DOM Approach

chibivue also implements the Mock DOM approach in `server-renderer`. This serves as a fallback when VNode SSR is not used.

### SSR Elements

We create classes that mimic DOM elements but store data in memory:

```ts
class SSRElement {
  tagName: string;
  attributes: Map<string, string> = new Map();
  children: (SSRElement | SSRText)[] = [];
  textContent: string = "";

  constructor(tagName: string) {
    this.tagName = tagName.toLowerCase();
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  addEventListener(): void {
    // No-op in SSR - events are client-side only
  }

  appendChild(child: SSRElement | SSRText): void {
    this.children.push(child);
  }

  toHTML(): string {
    let html = `<${this.tagName}`;
    for (const [name, value] of this.attributes) {
      html += ` ${name}="${escapeHtml(value)}"`;
    }
    html += ">";

    if (this.textContent) {
      html += escapeHtml(this.textContent);
    } else {
      for (const child of this.children) {
        html += child.toHTML();
      }
    }

    html += `</${this.tagName}>`;
    return html;
  }
}
```

## Usage Example

### Server-Side

```ts
import { createVNode } from "chibivue";
import { renderToString } from "@chibivue/server-renderer";
import App from "./App.vue";

// Render component to HTML string
const html = await renderToString(createVNode(App));

// Send HTML response
res.send(`
<!DOCTYPE html>
<html>
  <head><title>My App</title></head>
  <body>
    <div id="app">${html}</div>
    <script type="module" src="/src/entry-client.ts"></script>
  </body>
</html>
`);
```

### Client-Side

```ts
// entry-client.ts
import { createVaporSSRApp } from "@chibivue/runtime-vapor";
import App from "./App.vue";

// Hydrate SSR-rendered HTML
createVaporSSRApp(App).mount("#app");
```

## Comparison with Virtual DOM SSR

| Aspect | Virtual DOM SSR | Vapor SSR |
|--------|-----------------|-----------|
| Server Rendering | Traverses VNode tree, generates HTML | Same (uses VNode SSR) |
| Client Hydration | Uses VNode diff | Directly references/manipulates DOM |
| Bundle Size | Requires Virtual DOM runtime | Lightweight Vapor runtime |
| Update Performance | Goes through diff algorithm | Direct DOM manipulation |

## Architecture Benefits

The Vue.js-style Vapor SSR approach has the following benefits:

1. **Code Reuse**: Existing `compiler-ssr` can be used directly
2. **Consistent Output**: Server-generated HTML is identical to regular VNode SSR
3. **Gradual Migration**: Can coexist with non-Vapor components
4. **Maintainability**: No need to maintain a separate SSR compiler

<KawaikoNote variant="warning" title="Hydration Required">
The server-rendered HTML is static. For interactivity, you need to hydrate the Vapor components on the client side, which will set up the reactive effects and event listeners.
</KawaikoNote>

## Limitations

The current implementation is minimal and has some limitations:

1. **No streaming support**: The entire component is rendered before returning
2. **No Suspense support**: Async component SSR support is limited
3. **Hydration mismatch**: Warning functionality for client/server output differences is not implemented

<KawaikoNote variant="base" title="Future Improvements">
A more complete implementation would include:
- Streaming SSR support
- Hydration mismatch detection
- Suspense integration
</KawaikoNote>

## Summary

Vapor SSR works as follows:

1. **Server-Side**: Use `compiler-ssr` to generate HTML strings (same as VNode SSR)
2. **Client-Side**: Use `createVaporSSRApp` for hydration
3. **Hydration**: Reuse existing DOM elements while setting up reactivity

This approach allows Vapor components to benefit from SSR while gaining the performance benefits of direct DOM manipulation on the client side.
