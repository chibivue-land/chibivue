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
2. **Separate SSR Compiler**: Generate different code for SSR that outputs HTML strings directly

chibivue implements a simplified version of the mock DOM approach in `server-renderer`.

## Implementation

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

  get firstChild(): SSRElement | SSRText | null {
    return this.children[0] || null;
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

The key insight is that `toHTML()` converts the in-memory representation back to an HTML string.

### SSR Document

We also create a mock `document` object:

```ts
class SSRDocument {
  createElement(tagName: string): SSRElement {
    return new SSRElement(tagName);
  }

  createTextNode(text: string): SSRText {
    return new SSRText(text);
  }

  createComment(text: string): SSRText {
    return new SSRText(`<!--${text}-->`);
  }
}
```

### Rendering Vapor Components

The `renderVaporComponentToString` function sets up the SSR environment and executes the component:

```ts
export function renderVaporComponentToString(
  vnode: VNode,
  parentInstance: VaporComponentInternalInstance | null = null
): SSRBuffer | Promise<SSRBuffer> {
  const instance = createVaporComponentInstance(vnode, parentInstance);
  return renderVaporComponentSubTree(instance);
}

function renderVaporComponentSubTree(
  instance: VaporComponentInternalInstance
): SSRBuffer {
  const { getBuffer, push } = createBuffer();
  const comp = instance.type as VaporComponent;

  if (isFunction(comp)) {
    try {
      // Set up SSR environment
      setupSSRVaporGlobals();

      // Execute the vapor component
      comp(instance);

      // Get the rendered HTML
      push(ssrContext.getHTML());

      // Restore globals
      restoreVaporGlobals();
    } catch (e) {
      console.warn(`Vapor SSR render failed:`, e);
      push(`<!---->`);
    }
  }

  return getBuffer();
}
```

## Event Handling in SSR

Notice that `addEventListener` is a no-op in SSR:

```ts
addEventListener(): void {
  // No-op in SSR - events are client-side only
}
```

Event handlers only work on the client side. When the page loads in the browser, hydration will attach the actual event listeners.

<KawaikoNote type="warning" title="Hydration Required">
The server-rendered HTML is static. For interactivity, you need to hydrate the Vapor components on the client side, which will set up the reactive effects and event listeners.
</KawaikoNote>

## SSR Helper Functions

We also provide helper functions for generating SSR output:

```ts
// Render text with placeholder support
export function ssrVaporSetText(format: string, ...values: any[]): string {
  let text = format;
  for (let i = 0; i < values.length; i++) {
    text = text.replace("{}", String(values[i]));
  }
  return escapeHtml(text);
}

// Pass through template HTML
export function ssrVaporTemplate(html: string): string {
  return html;
}
```

## Usage Example

Here's how you might render a Vapor component on the server:

```ts
import { createVNode } from "chibivue";
import { renderVaporComponentToString } from "@chibivue/server-renderer";

// A simple vapor component
const Counter = (self) => {
  const el = template("<button>Count: 0</button>");
  return el;
};

// Render to string
const vnode = createVNode(Counter);
const buffer = await renderVaporComponentToString(vnode);
const html = unrollBuffer(buffer);

console.log(html);
// Output: <button>Count: 0</button>
```

## Comparison with Virtual DOM SSR

| Aspect | Virtual DOM SSR | Vapor SSR |
|--------|-----------------|-----------|
| Rendering | Traverses VNode tree, generates HTML | Mocks DOM, captures operations |
| Complexity | Straightforward recursive rendering | Requires DOM mocking layer |
| Output | Same HTML structure | Same HTML structure |
| Hydration | Standard hydration | Vapor-specific hydration needed |

Both approaches produce the same HTML output, but the implementation differs. The virtual DOM approach is conceptually simpler since it already works with data structures (VNodes) rather than actual DOM elements.

## Limitations

The current implementation is minimal and has some limitations:

1. **No streaming support**: The entire component is rendered before returning
2. **Limited DOM API coverage**: Only basic DOM operations are mocked
3. **No async component support**: Async vapor components may not work correctly

<KawaikoNote type="info" title="Future Improvements">
A more complete implementation would include:
- Full DOM API mocking
- Streaming support for large pages
- Better integration with the Vapor compiler for optimized SSR output
</KawaikoNote>

## Summary

Vapor SSR works by:

1. Creating mock DOM classes that store element data in memory
2. Swapping the global `document` with our mock during rendering
3. Executing the Vapor component, which builds up the mock DOM tree
4. Converting the mock DOM tree back to an HTML string

This approach allows Vapor components to work on the server without modification, though it requires a hydration step on the client to restore interactivity.

The combination of Vapor Compiler and Vapor SSR gives you the performance benefits of direct DOM manipulation while maintaining the ability to server-render your Vue applications.
