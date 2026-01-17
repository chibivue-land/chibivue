# Other Directives

So far, we have implemented major directives like v-bind, v-on, v-if, v-for, and v-model.\
In this chapter, we will implement the remaining built-in directives.

The directives we will implement are:

- v-text
- v-html
- v-cloak
- v-pre

For v-show, since it requires a runtime directive mechanism, we will cover it in the Custom Directives chapter.\
Also, v-once and v-memo are related to optimization, so they will be covered in the Optimizations section of Web Application Essentials.

## v-text

### Target Developer Interface

v-text is a directive that updates the element's textContent.

```vue
<script>
import { ref } from 'chibivue'

export default {
  setup() {
    const msg = ref('Hello!')
    return { msg }
  },
}
</script>

<template>
  <span v-text="msg"></span>
  <!-- Same as below -->
  <span>{{ msg }}</span>
</template>
```

https://vuejs.org/api/built-in-directives.html#v-text

### Implementation Approach

The implementation of v-text is very simple.\
At compile time, we just transform the v-text directive into a `textContent` property binding.

```html
<span v-text="msg"></span>
```

↓

```ts
h('span', { textContent: msg })
```

### Implementing the Transformer in compiler-dom

Since v-text is a DOM-specific directive, we implement it in compiler-dom.

Create `packages/compiler-dom/src/transforms/vText.ts`.

```ts
import {
  type DirectiveTransform,
  createObjectProperty,
  createSimpleExpression,
} from '@chibivue/compiler-core'

export const transformVText: DirectiveTransform = (dir, node, context) => {
  const { exp, loc } = dir
  if (!exp) {
    console.error(
      `v-text is missing expression.`,
    )
  }
  if (node.children.length) {
    console.error(
      `v-text will override element children.`,
    )
    node.children.length = 0
  }
  return {
    props: [
      createObjectProperty(
        createSimpleExpression(`textContent`, true),
        exp || createSimpleExpression('', true),
      ),
    ],
  }
}
```

The key points are:

- Output an error if exp doesn't exist
- Output a warning and clear children if they exist (since v-text overrides children)
- Bind exp as a `textContent` property

Then register the transformer in `packages/compiler-dom/src/index.ts`.

```ts
import { transformVText } from './transforms/vText'

export const DOMDirectiveTransforms: Record<string, DirectiveTransform> = {
  on: transformOn,
  model: transformModel,
  text: transformVText, // [!code ++]
}
```

That completes the v-text implementation!

## v-html

### Target Developer Interface

v-html is a directive that updates the element's innerHTML.

```vue
<script>
import { ref } from 'chibivue'

export default {
  setup() {
    const rawHtml = ref('<span style="color: red">This should be red.</span>')
    return { rawHtml }
  },
}
</script>

<template>
  <p>Using v-html directive: <span v-html="rawHtml"></span></p>
</template>
```

https://vuejs.org/api/built-in-directives.html#v-html

::: warning
Since v-html directly manipulates innerHTML, it can be a source of XSS vulnerabilities.\
Avoid displaying untrusted user input with v-html.
:::

### Implementation Approach

Like v-text, v-html is transformed into an `innerHTML` property binding at compile time.

```html
<span v-html="rawHtml"></span>
```

↓

```ts
h('span', { innerHTML: rawHtml })
```

### Implementing the Transformer in compiler-dom

Create `packages/compiler-dom/src/transforms/vHtml.ts`.

```ts
import {
  type DirectiveTransform,
  createObjectProperty,
  createSimpleExpression,
} from '@chibivue/compiler-core'

export const transformVHtml: DirectiveTransform = (dir, node, context) => {
  const { exp, loc } = dir
  if (!exp) {
    console.error(
      `v-html is missing expression.`,
    )
  }
  if (node.children.length) {
    console.error(
      `v-html will override element children.`,
    )
    node.children.length = 0
  }
  return {
    props: [
      createObjectProperty(
        createSimpleExpression(`innerHTML`, true, loc),
        exp || createSimpleExpression('', true),
      ),
    ],
  }
}
```

It has almost the same structure as v-text. The only difference is using `innerHTML` instead of `textContent`.

Register the transformer in `packages/compiler-dom/src/index.ts`.

```ts
import { transformVHtml } from './transforms/vHtml'

export const DOMDirectiveTransforms: Record<string, DirectiveTransform> = {
  on: transformOn,
  model: transformModel,
  text: transformVText,
  html: transformVHtml, // [!code ++]
}
```

That completes the v-html implementation!

## v-cloak

### Target Developer Interface

v-cloak is a directive used to hide an element until the component is mounted.\
It's used in combination with CSS to prevent users from seeing uncompiled template syntax (like mustaches).

```html
<style>
[v-cloak] {
  display: none;
}
</style>

<div v-cloak>
  {{ message }}
</div>
```

After mounting, the v-cloak attribute is automatically removed.

https://vuejs.org/api/built-in-directives.html#v-cloak

### Implementation Approach

The implementation of v-cloak is very simple.\
We just need to remove the v-cloak attribute from the element when mounting.

This is processed on the runtime side, not in the compiler.\
Specifically, we add processing in the `mountElement` function in `renderer.ts`.

### Implementing in Runtime

Add the following processing to the `mountElement` function in `packages/runtime-core/src/renderer.ts`.

```ts
const mountElement = (
  vnode: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
) => {
  let el: RendererElement
  const { type, props, children, shapeFlag } = vnode

  el = vnode.el = hostCreateElement(type as string)

  // ... existing processing ...

  // Remove v-cloak // [!code ++]
  if (props && 'v-cloak' in props) { // [!code ++]
    delete (el as any)['v-cloak'] // [!code ++]
    hostRemoveAttribute(el, 'v-cloak') // [!code ++]
  } // [!code ++]

  hostInsert(el, container, anchor)

  // ... existing processing ...
}
```

While we could use existing `hostPatchProp` to implement `hostRemoveAttribute`, let's simply add it to `nodeOps`.

Add to `packages/runtime-dom/src/nodeOps.ts`.

```ts
export const nodeOps: Omit<RendererOptions, 'patchProp'> = {
  // ... existing processing ...
  removeAttribute: (el, key) => {
    el.removeAttribute(key)
  },
}
```

Also add to the `RendererOptions` type in `packages/runtime-core/src/renderer.ts`.

```ts
export interface RendererOptions<
  HostNode = RendererNode,
  HostElement = RendererElement,
> {
  // ... existing processing ...
  removeAttribute(el: HostElement, key: string): void
}
```

That completes the v-cloak implementation!

## v-pre

### Target Developer Interface

v-pre is a directive that skips compilation for this element and all its children.\
It's used when you want to display mustache syntax as-is.

```vue
<template>
  <span v-pre>{{ this will not be compiled }}</span>
</template>
```

The template above will display the text `{{ this will not be compiled }}` as-is.

https://vuejs.org/api/built-in-directives.html#v-pre

### Implementation Approach

Unlike other directives, v-pre is processed at the parser stage.\
When we detect an element with the v-pre attribute, we skip parsing of directives and mustache syntax for that element and its children.

### Implementing in Parser

Add v-pre processing to `packages/compiler-core/src/parse.ts`.

First, add an `inVPre` flag to the parser context.

```ts
export interface ParserContext {
  // ... existing properties ...
  inVPre: boolean // [!code ++]
}

function createParserContext(content: string, options: ParserOptions): ParserContext {
  return {
    // ... existing processing ...
    inVPre: false, // [!code ++]
  }
}
```

Next, check for the v-pre attribute when parsing elements, and set `inVPre` to true in that case.

```ts
function parseElement(
  context: ParserContext,
  ancestors: ElementNode[],
): ElementNode | undefined {
  // Start tag
  const element = parseTag(context, TagType.Start)

  // Check for v-pre // [!code ++]
  const isPreBoundary = element.props.some( // [!code ++]
    p => p.type === NodeTypes.DIRECTIVE && p.name === 'pre' // [!code ++]
  ) // [!code ++]
  if (isPreBoundary) { // [!code ++]
    context.inVPre = true // [!code ++]
  } // [!code ++]

  // Children
  if (!element.isSelfClosing) {
    ancestors.push(element)
    const children = parseChildren(context, ancestors)
    ancestors.pop()
    element.children = children

    // End tag
    if (startsWithEndTagOpen(context.source, element.tag)) {
      parseTag(context, TagType.End)
    }
  }

  // End of v-pre // [!code ++]
  if (isPreBoundary) { // [!code ++]
    context.inVPre = false // [!code ++]
  } // [!code ++]

  return element
}
```

Then, skip parsing of directives and mustache syntax when `inVPre` is true.

Modify the `parseAttribute` function.

```ts
function parseAttribute(
  context: ParserContext,
  nameSet: Set<string>,
): AttributeNode | DirectiveNode {
  // ... attribute name parsing ...

  // Don't parse as directive when in v-pre // [!code ++]
  if (context.inVPre) { // [!code ++]
    return { // [!code ++]
      type: NodeTypes.ATTRIBUTE, // [!code ++]
      name, // [!code ++]
      value: value && { // [!code ++]
        type: NodeTypes.TEXT, // [!code ++]
        content: value.content, // [!code ++]
        loc: value.loc, // [!code ++]
      }, // [!code ++]
      loc, // [!code ++]
    } // [!code ++]
  } // [!code ++]

  // Directive parsing ...
}
```

Also modify the `parseChildren` function to skip mustache syntax parsing.

```ts
function parseChildren(
  context: ParserContext,
  ancestors: ElementNode[],
): TemplateChildNode[] {
  const nodes: TemplateChildNode[] = []

  while (!isEnd(context, ancestors)) {
    const s = context.source
    let node: TemplateChildNode | undefined = undefined

    if (startsWith(s, context.options.delimiters[0])) {
      // Skip mustache when in v-pre // [!code ++]
      if (!context.inVPre) { // [!code ++]
        node = parseInterpolation(context)
      } // [!code ++]
    } else if (s[0] === '<') {
      // ... element parsing ...
    }

    if (!node) {
      node = parseText(context)
    }

    nodes.push(node)
  }

  return nodes
}
```

That completes the v-pre implementation!

## Checking the Behavior

Let's verify that the implemented directives work correctly.

```vue
<script>
import { ref } from 'chibivue'

export default {
  setup() {
    const msg = ref('Hello, chibivue!')
    const rawHtml = ref('<span style="color: red">Red text</span>')
    return { msg, rawHtml }
  },
}
</script>

<template>
  <div>
    <h2>v-text</h2>
    <span v-text="msg"></span>

    <h2>v-html</h2>
    <div v-html="rawHtml"></div>

    <h2>v-pre</h2>
    <span v-pre>{{ msg }} will not be compiled</span>
  </div>
</template>
```

Did it work correctly?\
This completes the implementation of basic built-in directives!

v-show and custom directives will be covered in the next chapter.\
v-once and v-memo will be covered in the optimization chapter.

Source code up to this point:\
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/090_other_directives)
