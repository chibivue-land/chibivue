# Compiling the template block

## Switching the Compiler

`descriptor.script.content` and `descriptor.template.content` contain the source code of each section.  
Let's compile them successfully. Let's start with the template section.  
We already have the template compiler.  
However, as you can see from the following code,

```ts
export const generate = ({
  children,
}: {
  children: TemplateChildNode[]
}): string => {
  return `return function render(_ctx) {
  with (_ctx) {
    const { h } = ChibiVue;
    return ${genNode(children[0])};
  }
}`
}
```

This assumes that it will be used with the Function constructor, so it includes the `return` statement at the beginning.  
In the SFC compiler, we only want to generate the render function, so let's make it possible to branch with compiler options.  
Let's make it possible to receive options as the second argument of the compiler and specify a flag called `isBrowser`.  
When this variable is `true`, it outputs code that assumes it will be `new` on the runtime, and when it is `false`, it simply generates code.

```sh
pwd # ~
touch packages/compiler-core/options.ts
```

`packages/compiler-core/options.ts`

```ts
export type CompilerOptions = {
  isBrowser?: boolean
}
```

`~/packages/compiler-dom/index.ts`

```ts
export function compile(template: string, option?: CompilerOptions) {
  const defaultOption: Required<CompilerOptions> = { isBrowser: true }
  if (option) Object.assign(defaultOption, option)
  return baseCompile(template, defaultOption)
}
```

`~/packages/compiler-core/compile.ts`

```ts
export function baseCompile(
  template: string,
  option: Required<CompilerOptions>,
) {
  const parseResult = baseParse(template.trim())
  const code = generate(parseResult, option)
  return code
}
```

`~/packages/compiler-core/codegen.ts`

```ts
export const generate = (
  {
    children,
  }: {
    children: TemplateChildNode[]
  },
  option: Required<CompilerOptions>,
): string => {
  return `${option.isBrowser ? 'return ' : ''}function render(_ctx) {
  const { h } = ChibiVue;
  return ${genNode(children[0])};
}`
}
```

I also added the import statement. I changed it to add the generated source code to the `output` array.

```ts
import type { Plugin } from 'vite'
import { createFilter } from 'vite'
import { parse } from '../../compiler-sfc'
import { compile } from '../../compiler-dom'

export default function vitePluginChibivue(): Plugin {
  const filter = createFilter(/\.vue$/)

  return {
    name: 'vite:chibivue',

    transform(code, id) {
      if (!filter(id)) return

      const outputs = []
      outputs.push("import * as ChibiVue from 'chibivue'\n")

      const { descriptor } = parse(code, { filename: id })
      const templateCode = compile(descriptor.template?.content ?? '', {
        isBrowser: false,
      })
      outputs.push(templateCode)

      outputs.push('\n')
      outputs.push(`export default { render }`)

      return { code: outputs.join('\n') }
    },
  }
}
```

## Issues

Now you should be able to compile the render function. Let's check it in the browser's source.

However, there is a small problem.

When binding data to the template, I think you are using the `with` statement. \
However, due to the nature of Vite handling ESM, it cannot process code that only works in non-strict mode (sloppy mode) and cannot handle `with` statements.  
So far, it hasn't been a problem because I was simply passing code (strings) containing `with` statements to the Function constructor and making it a function in the browser, but now it throws an error. \
You should see an error like this:

> Strict mode code may not include a with statement

This is also described in the Vite official documentation as a troubleshooting tip.

[Syntax Error / Type Error Occurs (Vite)](https://vitejs.dev/guide/troubleshooting.html#syntax-error-type-error-occurs)

As a temporary solution, let's try to generate code that does not include the `with` statement when it is not in browser mode.

Specifically, for the data to be bound, let's try to control it by adding the prefix `_ctx.` instead of using the `with` statement.\
Since this is a temporary solution, it is not very strict, but I think it will work generally.\
(The proper solution will be implemented in a later chapter.)

```ts
export const generate = (
  {
    children,
  }: {
    children: TemplateChildNode[]
  },
  option: Required<CompilerOptions>,
): string => {
  // Generate code that does not include the `with` statement when `isBrowser` is false
  return `${option.isBrowser ? 'return ' : ''}function render(_ctx) {
    ${option.isBrowser ? 'with (_ctx) {' : ''}
      const { h } = ChibiVue;
      return ${genNode(children[0], option)};
    ${option.isBrowser ? '}' : ''}
}`
}

// .
// .
// .

const genNode = (
  node: TemplateChildNode,
  option: Required<CompilerOptions>,
): string => {
  switch (node.type) {
    case NodeTypes.ELEMENT:
      return genElement(node, option)
    case NodeTypes.TEXT:
      return genText(node)
    case NodeTypes.INTERPOLATION:
      return genInterpolation(node, option)
    default:
      return ''
  }
}

const genElement = (
  el: ElementNode,
  option: Required<CompilerOptions>,
): string => {
  return `h("${el.tag}", {${el.props
    .map(prop => genProp(prop, option))
    .join(', ')}}, [${el.children.map(it => genNode(it, option)).join(', ')}])`
}

const genProp = (
  prop: AttributeNode | DirectiveNode,
  option: Required<CompilerOptions>,
): string => {
  switch (prop.type) {
    case NodeTypes.ATTRIBUTE:
      return `${prop.name}: "${prop.value?.content}"`
    case NodeTypes.DIRECTIVE: {
      switch (prop.name) {
        case 'on':
          return `${toHandlerKey(prop.arg)}: ${
            option.isBrowser ? '' : '_ctx.' // -------------------- Here
          }${prop.exp}`
        default:
          // TODO: other directives
          throw new Error(`unexpected directive name. got "${prop.name}"`)
      }
    }
    default:
      throw new Error(`unexpected prop type.`)
  }
}

// .
// .
// .

const genInterpolation = (
  node: InterpolationNode,
  option: Required<CompilerOptions>,
): string => {
  return `${option.isBrowser ? '' : '_ctx.'}${node.content}` // ------------ Here
}
```

![compile_sfc_render](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/compile_sfc_render.png)

It seems that it was compiled successfully. All that's left is to extract the script in the same way and put it into the default exports.

Source code up to this point:  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/070_sfc_compiler3)
