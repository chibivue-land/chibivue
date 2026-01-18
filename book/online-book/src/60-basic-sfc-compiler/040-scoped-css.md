# Supporting Scoped CSS

::: info About this chapter
This chapter explains how to implement Vue's Scoped CSS feature.\
Learn how to isolate styles per component and prevent style conflicts.
:::

## What is Scoped CSS?

Scoped CSS is a feature that applies styles defined in `<style scoped>` only to that component.

```vue
<template>
  <p class="message">Hello</p>
</template>

<style scoped>
.message {
  color: red;
}
</style>
```

This style will not affect elements with the same class name in other components.

<KawaikoNote variant="question" title="Why do we need Scoped CSS?">

In large applications, different components may use the same class names.\
Without Scoped CSS, styles could unintentionally affect other components.\
By isolating styles per component, you can style safely!

</KawaikoNote>

## How It Works

Scoped CSS is implemented through these steps:

1. **Generate scope ID**: Create a unique ID for each component
2. **Transform template**: Add `data-v-xxx` attribute to elements
3. **Transform styles**: Add `[data-v-xxx]` to selectors

### Transformation Example

```vue
<!-- Input -->
<template>
  <p class="message">Hello</p>
</template>

<style scoped>
.message {
  color: red;
}
</style>
```

```html
<!-- Output (HTML) -->
<p class="message" data-v-7ba5bd90>Hello</p>

<!-- Output (CSS) -->
<style>
.message[data-v-7ba5bd90] {
  color: red;
}
</style>
```

## Generating Scope ID

Generate a unique ID for each component. Usually uses a hash of the file path.

```ts
// packages/compiler-sfc/src/parse.ts

import { createHash } from 'crypto'

export function parse(
  source: string,
  { filename = DEFAULT_FILENAME }: SFCParseOptions = {},
): SFCParseResult {
  const descriptor: SFCDescriptor = {
    id: undefined!,
    filename,
    source,
    template: null,
    script: null,
    scriptSetup: null,
    styles: [],
  }

  // Generate scope ID
  descriptor.id = createHash('sha256')
    .update(filename + source)
    .digest('hex')
    .slice(0, 8)

  // ... rest of parsing
}
```

## Extending SFCStyleBlock

Add scoped information to the style block.

```ts
// packages/compiler-sfc/src/parse.ts

export interface SFCStyleBlock extends SFCBlock {
  type: "style"
  scoped?: boolean  // Added
}

function createBlock(node: ElementNode, source: string): SFCBlock {
  // ...
  node.props.forEach((p) => {
    if (p.type === NodeTypes.ATTRIBUTE) {
      attrs[p.name] = p.value ? p.value.content || true : true
      if (type === "style") {
        if (p.name === "scoped") {
          (block as SFCStyleBlock).scoped = true
        }
      }
    }
  })
  return block
}
```

## Template Transformation

Add the scopeId attribute to elements during template compilation.

```ts
// packages/compiler-core/src/codegen.ts

function genVNodeCall(node: VNodeCall, context: CodegenContext) {
  const { push, helper, scopeId } = context
  const { tag, props, children } = node

  // Add scopeId to props if present
  let propsWithScope = props
  if (scopeId) {
    const scopeIdProp = `"data-v-${scopeId}": ""`
    if (props) {
      // Merge with existing props
      propsWithScope = `{ ...${props}, ${scopeIdProp} }`
    } else {
      propsWithScope = `{ ${scopeIdProp} }`
    }
  }

  push(helper(CREATE_ELEMENT_VNODE) + `(`)
  genNodeList(genNullableArgs([tag, propsWithScope, children]), context)
  push(`)`)
}
```

## Style Transformation

Add scope attribute selectors to CSS selectors.

```ts
// packages/compiler-sfc/src/compileStyle.ts

import postcss from 'postcss'

export interface SFCStyleCompileOptions {
  source: string
  filename: string
  id: string
  scoped?: boolean
}

export function compileStyle(options: SFCStyleCompileOptions): string {
  const { source, id, scoped } = options

  if (!scoped) {
    return source
  }

  // Transform selectors using PostCSS
  const result = postcss([scopedPlugin(id)]).process(source, { from: undefined })
  return result.css
}

function scopedPlugin(id: string) {
  const scopeId = `data-v-${id}`

  return {
    postcssPlugin: 'vue-sfc-scoped',
    Rule(rule) {
      // Add [data-v-xxx] to selectors
      rule.selectors = rule.selectors.map((selector) => {
        return `${selector}[${scopeId}]`
      })
    },
  }
}
```

## Vite Plugin Integration

```ts
// packages/@extensions/vite-plugin-chibivue/src/main.ts

async function genStyleCode(descriptor: SFCDescriptor): Promise<string> {
  let stylesCode = ``

  for (let i = 0; i < descriptor.styles.length; i++) {
    const style = descriptor.styles[i]
    const src = descriptor.filename
    const scoped = style.scoped ? '&scoped=true' : ''
    const query = `?chibivue&type=style&index=${i}${scoped}&lang.css`
    const styleRequest = src + query
    stylesCode += `\nimport ${JSON.stringify(styleRequest)}`
  }

  return stylesCode
}

// Compile styles in Vite plugin's load
load(id) {
  const { filename, query } = parseChibiVueRequest(id)
  if (query.chibivue && query.type === "style") {
    const descriptor = getDescriptor(filename, options)!
    const style = descriptor.styles[query.index!]

    if (query.scoped) {
      return {
        code: compileStyle({
          source: style.content,
          filename,
          id: descriptor.id,
          scoped: true,
        })
      }
    }

    return { code: style.content }
  }
}
```

<KawaikoNote variant="surprise" title="The Power of PostCSS!">

We use PostCSS for style transformation.\
PostCSS is a tool that can handle CSS as an AST, making selector transformation easy.\
Vue.js also uses PostCSS internally!

</KawaikoNote>

## Testing

```vue
<!-- ComponentA.vue -->
<template>
  <p class="text">Component A</p>
</template>

<style scoped>
.text {
  color: red;
}
</style>
```

```vue
<!-- ComponentB.vue -->
<template>
  <p class="text">Component B</p>
</template>

<style scoped>
.text {
  color: blue;
}
</style>
```

Both components use the same class name `.text`, but they display in different colors.

## Special Selectors

Scoped CSS supports several special selectors.

### :deep() Selector

Used when you want to style child components.

```vue
<style scoped>
:deep(.child-class) {
  color: blue;
}
</style>
```

Transformed output:

```css
[data-v-xxx] .child-class {
  color: blue;
}
```

### ::v-slotted() Selector

Applies styles to slotted content.

```vue
<style scoped>
::v-slotted(.slot-content) {
  font-weight: bold;
}
</style>
```

Transformed output:

```css
.slot-content[data-v-xxx-s] {
  font-weight: bold;
}
```

The `-s` suffix stands for "slotted".
Since slotted content comes from the parent component,
a special slotted scope ID is used instead of the regular scope ID.

### :global() Selector

Defines global styles within a scoped style block.

```vue
<style scoped>
:global(.global-class) {
  margin: 0;
}
</style>
```

Transformed output:

```css
.global-class {
  margin: 0;
}
```

## Dynamic Styles with v-bind()

You can use component state in CSS.

```vue
<script setup>
import { ref } from 'vue'
const color = ref('red')
</script>

<style scoped>
.text {
  color: v-bind(color);
}
</style>
```

Transformed output:

```css
.text[data-v-xxx] {
  color: var(--xxx-color);
}
```

`v-bind()` is converted to a CSS custom property (CSS variable).
At runtime, the CSS variable value is set as an inline style on the component.

### Using Complex Expressions

You can use complex expressions by wrapping them in quotes.

```vue
<style scoped>
.box {
  width: v-bind('size + "px"');
  background: v-bind('theme.colors.primary');
}
</style>
```

<KawaikoNote variant="warning" title="Performance Considerations for v-bind()">

`v-bind()` is a convenient feature, but it has performance implications:

- Each `v-bind()` is set as a CSS custom property in inline styles
- Style recalculation is triggered every time the value changes
- For frequently changing values, using inline styles directly may be more efficient

For animations or frequent updates, consider using inline styles or CSS animations instead of `v-bind()`.

</KawaikoNote>

## Future Enhancements

These features could also be considered:

- **CSS Modules**: Automatic class name generation
- **CSS-in-JS Integration**: Enhanced dynamic styling

<KawaikoNote variant="base" title="Try Implementing It!">

Use the concepts explained in this chapter to implement Scoped CSS yourself!\
It's also a great opportunity to learn how to use PostCSS.

</KawaikoNote>

Source code up to this point:
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/60_basic_sfc_compiler/040_scoped_css)

## Summary

- Scoped CSS isolates styles per component
- Generate a unique scopeId and apply to template and styles
- Template gets `data-v-xxx` attribute, CSS gets `[data-v-xxx]` selector
- Use PostCSS to transform selectors

## References

- [Vue.js - Scoped CSS](https://vuejs.org/api/sfc-css-features.html#scoped-css) - Vue Official Documentation
- [PostCSS](https://postcss.org/) - CSS Transformation Tool
