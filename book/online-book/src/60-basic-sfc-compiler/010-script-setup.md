# Supporting script setup

::: info About this chapter
This chapter explains how to implement Vue 3's `<script setup>` syntax.\
Learn how script setup works to write components more concisely.
:::

## What is script setup?

`<script setup>` is a compile-time syntactic sugar introduced in Vue 3.2. It allows you to write components more concisely compared to the traditional Options API or Composition API.

```vue
<!-- Traditional way -->
<script>
import { ref } from 'chibivue'
import MyComponent from './MyComponent.vue'

export default {
  components: { MyComponent },
  setup() {
    const count = ref(0)
    const increment = () => count.value++
    return { count, increment }
  }
}
</script>

<!-- script setup way -->
<script setup>
import { ref } from 'chibivue'
import MyComponent from './MyComponent.vue'

const count = ref(0)
const increment = () => count.value++
</script>
```

<KawaikoNote variant="surprise" title="So much shorter!">

With script setup, you don't need `export default` or `return`, and imported components are automatically registered.\
The code becomes much cleaner!

</KawaikoNote>

## Implementation Overview

Compiling script setup involves the following steps:

1. **Import analysis and hoisting**: Extract import statements and move them to the top of the file
2. **Binding analysis**: Track variable declarations and function definitions
3. **Macro processing**: Handle defineProps, defineEmits, etc. (covered in later chapters)
4. **Code transformation**: Transform into setup function and generate return statement

## The compileScript Function

The `compileScript` function is the central function that compiles the script portion of an SFC.

```ts
// packages/compiler-sfc/src/compileScript.ts

export function compileScript(
  sfc: SFCDescriptor,
  options: SFCScriptCompileOptions,
): SFCScriptBlock {
  let { script, scriptSetup, source } = sfc

  // Parse with Babel
  const scriptAst = _parse(script?.content ?? "", { sourceType: "module" }).program
  const scriptSetupAst = _parse(scriptSetup?.content ?? "", { sourceType: "module" }).program

  // Traditional processing if no script setup
  if (!scriptSetup) {
    if (!script) {
      throw new Error(`SFC contains no <script> tags.`)
    }
    return { ...script, bindings: analyzeScriptBindings(scriptAst.body) }
  }

  // Initialize metadata
  const bindingMetadata: BindingMetadata = {}
  const userImports: Record<string, ImportBinding> = Object.create(null)
  const setupBindings: Record<string, BindingTypes> = Object.create(null)

  const s = new MagicString(source)
  // ... transformation processing
}
```

## Import Hoisting

Import statements inside script setup need to be moved (hoisted) to the beginning of the generated code.

```ts
// 1.2 walk import declarations of <script setup>
for (const node of scriptSetupAst.body) {
  if (node.type === "ImportDeclaration") {
    // Move import to file top
    hoistNode(node)

    // Remove duplicate imports
    for (let i = 0; i < node.specifiers.length; i++) {
      const specifier = node.specifiers[i]
      const local = specifier.local.name
      const imported = getImportedName(specifier)
      const source = node.source.value

      const existing = userImports[local]
      if (existing) {
        if (existing.source === source && existing.imported === imported) {
          removeSpecifier(i)
        }
      } else {
        registerUserImport(source, local, imported, true)
      }
    }
  }
}
```

<KawaikoNote variant="question" title="Why is hoisting necessary?">

In the generated code, import statements need to be placed outside the `setup()` function.\
Hoisting moves imports written inside `<script setup>` to the correct position.

</KawaikoNote>

## Binding Analysis

To correctly resolve variables referenced from the template, we analyze bindings in the script.

```ts
function walkDeclaration(
  node: Declaration,
  bindings: Record<string, BindingTypes>,
  userImportAliases: Record<string, string> = {},
) {
  if (node.type === "VariableDeclaration") {
    const isConst = node.kind === "const"

    for (const { id, init } of node.declarations) {
      if (id.type === "Identifier") {
        let bindingType
        if (isConst && isStaticNode(init!)) {
          bindingType = BindingTypes.LITERAL_CONST
        } else if (isCallOf(init, userImportAliases["reactive"])) {
          bindingType = BindingTypes.SETUP_REACTIVE_CONST
        } else if (isCallOf(init, userImportAliases["ref"])) {
          bindingType = BindingTypes.SETUP_REF
        } else if (isConst) {
          bindingType = BindingTypes.SETUP_MAYBE_REF
        } else {
          bindingType = BindingTypes.SETUP_LET
        }
        registerBinding(bindings, id, bindingType)
      }
    }
  } else if (node.type === "FunctionDeclaration") {
    bindings[node.id!.name] = BindingTypes.SETUP_CONST
  }
}
```

The binding type determines how the variable is referenced in the template:

| Type | Description | Template Reference |
|------|-------------|-------------------|
| `SETUP_REF` | Created with ref() | Auto-adds `.value` |
| `SETUP_REACTIVE_CONST` | Created with reactive() | Direct reference |
| `SETUP_CONST` | Constant | Direct reference |
| `SETUP_LET` | let/var variable | Direct reference |

## Inline Template

When using script setup, the template can be inlined inside the setup function.

```ts
// 10. generate return statement
let returned
if (options.inlineTemplate) {
  if (sfc.template) {
    const { code, preamble } = compileTemplate({
      source: sfc.template.content.trim(),
      compilerOptions: { inline: true, bindingMetadata },
    })

    if (preamble) {
      s.prepend(preamble)
    }
    returned = code
  } else {
    returned = `() => {}`
  }
}
s.appendRight(endOffset, `\nreturn ${returned}\n`)
```

Example of generated code:

```ts
// Input
// <script setup>
// import { ref } from 'chibivue'
// const count = ref(0)
// </script>
// <template>
//   <p>{{ count }}</p>
// </template>

// Output
import { ref } from 'chibivue'

export default {
  setup(__props) {
    const count = ref(0)

    return (_ctx) => {
      return h('p', count.value)
    }
  }
}
```

## Integration with Vite Plugin

The Vite plugin detects and compiles script setup.

```ts
// packages/@extensions/vite-plugin-chibivue/src/script.ts

export function resolveScript(
  descriptor: SFCDescriptor,
  options: ResolvedOptions,
): SFCScriptBlock | null {
  if (!descriptor.script && !descriptor.scriptSetup) return null

  return options.compiler.compileScript(descriptor, {
    inlineTemplate: isUseInlineTemplate(descriptor),
  })
}

export function isUseInlineTemplate(descriptor: SFCDescriptor): boolean {
  return !!descriptor.scriptSetup
}
```

## Testing

```vue
<script setup>
import { ref, computed } from 'chibivue'

const count = ref(0)
const double = computed(() => count.value * 2)

const increment = () => {
  count.value++
}
</script>

<template>
  <div>
    <p>Count: {{ count }}</p>
    <p>Double: {{ double }}</p>
    <button @click="increment">+1</button>
  </div>
</template>
```

<KawaikoNote variant="base" title="Implementation Complete!">

The basic implementation of script setup is complete!\
You can now write components much more concisely compared to the traditional way.\
In the next chapter, we'll learn how to implement the `defineProps` and `defineEmits` macros.

</KawaikoNote>

Source code up to this point:
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/60_basic_sfc_compiler/010_script_setup)

## Summary

- `<script setup>` is syntactic sugar for writing Composition API more concisely
- `compileScript` handles the central transformation processing
- Import hoisting and binding analysis are important steps
- The template is inlined inside the setup function

## References

- [Vue.js - script setup](https://vuejs.org/api/sfc-script-setup.html) - Vue Official Documentation
- [RFC: script setup](https://github.com/vuejs/rfcs/blob/master/active-rfcs/0040-script-setup.md) - Vue RFC
