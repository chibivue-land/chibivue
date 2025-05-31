# 编译模板块

## 切换编译器

`descriptor.script.content` 和 `descriptor.template.content` 包含每个部分的源代码．\
让我们成功编译它们．让我们从模板部分开始．\
我们已经有了模板编译器．\
但是，正如你从以下代码中看到的，

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

这假设它将与 Function 构造函数一起使用，所以它在开头包含 `return` 语句．\
在 SFC 编译器中，我们只想生成渲染函数，所以让我们使其能够通过编译器选项进行分支．\
让我们使其能够接收选项作为编译器的第二个参数，并指定一个名为 `isBrowser` 的标志．\
当这个变量为 `true` 时，它输出假设将在运行时 `new` 的代码，当它为 `false` 时，它只是生成代码．

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

我还添加了导入语句．我将其更改为将生成的源代码添加到 `output` 数组中．

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

## 问题

现在你应该能够编译渲染函数了．让我们在浏览器的源代码中检查它．

但是，有一个小问题．

当将数据绑定到模板时，我认为你正在使用 `with` 语句．\
但是，由于 Vite 处理 ESM 的性质，它无法处理只在非严格模式（sloppy mode）下工作的代码，并且无法处理 `with` 语句．\
到目前为止，这还不是问题，因为我只是将包含 `with` 语句的代码（字符串）传递给 Function 构造函数并在浏览器中使其成为函数，但现在它会抛出错误．\
你应该看到这样的错误：

> Strict mode code may not include a with statement

这也在 Vite 官方文档中作为故障排除提示进行了描述．

[Syntax Error / Type Error Occurs (Vite)](https://vitejs.dev/guide/troubleshooting.html#syntax-error-type-error-occurs)

作为临时解决方案，让我们尝试在非浏览器模式下生成不包含 `with` 语句的代码．

具体来说，对于要绑定的数据，让我们尝试通过添加前缀 `_ctx.` 而不是使用 `with` 语句来控制它．\
由于这是一个临时解决方案，它不是很严格，但我认为它通常会工作．\
（正确的解决方案将在后面的章节中实现．）

```ts
export const generate = (
  {
    children,
  }: {
    children: TemplateChildNode[]
  },
  option: Required<CompilerOptions>,
): string => {
  // 当 `isBrowser` 为 false 时生成不包含 `with` 语句的代码
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
            option.isBrowser ? '' : '_ctx.' // -------------------- 这里
          }${prop.exp}`
        default:
          // TODO: 其他指令
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
  return `${option.isBrowser ? '' : '_ctx.'}${node.content}` // ------------ 这里
}
```

![compile_sfc_render](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/compile_sfc_render.png)

看起来编译成功了．剩下的就是以同样的方式提取脚本并将其放入默认导出中．

到此为止的源代码：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/070_sfc_compiler3)
