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

## Future Enhancements

Scoped CSS is not yet implemented in chibivue, but these features could be considered:

- **:deep() selector**: Style child components
- **:slotted() selector**: Style slotted content
- **:global() selector**: Define global styles
- **CSS Modules**: Automatic class name generation

<KawaikoNote variant="base" title="Try Implementing It!">

Use the concepts explained in this chapter to implement Scoped CSS yourself!\
It's also a great opportunity to learn how to use PostCSS.

</KawaikoNote>

## Summary

- Scoped CSS isolates styles per component
- Generate a unique scopeId and apply to template and styles
- Template gets `data-v-xxx` attribute, CSS gets `[data-v-xxx]` selector
- Use PostCSS to transform selectors

## References

- [Vue.js - Scoped CSS](https://vuejs.org/api/sfc-css-features.html#scoped-css) - Vue Official Documentation
- [PostCSS](https://postcss.org/) - CSS Transformation Tool
