# 编译脚本块

## 我们想要做什么

现在，SFC 的原始脚本部分看起来像这样：

```ts
export default {
  setup() {},
}
```

我想只提取以下部分：

```ts
  {
  setup() {},
}
```

有什么方法可以做到这一点吗？

如果我可以提取这部分，我可以将其与之前生成的渲染函数很好地混合，并按如下方式导出：

```ts
const _sfc_main = {
  setup() {},
}

export default { ..._sfc_main, render }
```

## 使用外部库

为了实现上述目标，我将使用以下两个库：

- @babel/parser
- magic-string

### Babel

https://babeljs.io

[What is Babel](https://babeljs.io/docs)

如果你熟悉 JavaScript，你可能听说过 Babel．\
Babel 是一个用于将 JavaScript 转换为向后兼容版本的工具链．\
简单来说，它是一个从 JS 到 JS 的编译器（转译器）．

在这种情况下，我将使用 Babel 不仅作为编译器，还作为解析器．\
Babel 有一个内部解析器用于转换为 AST，因为它扮演编译器的角色．

AST 代表抽象语法树，它是 JavaScript 代码的表示．\
你可以在这里找到 AST 规范 (https://github.com/estree/estree)。\
虽然你可以参考 GitHub md 文件，但我将简要解释 JavaScript 中的 AST．\
整个程序由一个 Program AST 节点表示，它包含一个语句数组（为了清晰起见，使用 TS 接口表示）．

```ts
interface Program {
  body: Statement[]
}
```

Statement 表示 JavaScript 中的"语句"，它是语句的集合．\
示例包括"变量声明语句"，"if 语句"，"for 语句"和"块语句"．

```ts
interface Statement {}

interface VariableDeclaration extends Statement {
  /* 省略 */
}

interface IfStatement extends Statement {
  /* 省略 */
}

interface ForStatement extends Statement {
  /* 省略 */
}

interface BlockStatement extends Statement {
  body: Statement[]
}
// 还有更多
```

语句通常在大多数情况下都有一个"表达式"．\
表达式是可以分配给变量的东西．\
示例包括"对象"，"二元运算"和"函数调用"．

```ts
interface Expression {}

interface BinaryExpression extends Expression {
  operator: '+' | '-' | '*' | '/' // 还有更多，但省略了
  left: Expression
  right: Expression
}

interface ObjectExpression extends Expression {
  properties: Property[] // 省略
}

interface CallExpression extends Expression {
  callee: Expression
  arguments: Expression[]
}

// 还有更多
```

如果我们考虑一个 if 语句，它具有以下结构：

```ts
interface IfStatement extends Statement {
  test: Expression // 条件
  consequent: Statement // 如果条件为真要执行的语句
  alternate: Statement | null // 如果条件为假要执行的语句
}
```

通过这种方式，JavaScript 语法被解析为上述 AST．\
我认为对于那些已经为 chibivue 实现了模板编译器的人来说，这个解释很容易理解．（这是同样的事情）

我使用 Babel 的原因有两个．\
首先，这只是因为它很麻烦．\
如果你之前实现过解析器，在参考 estree 的同时实现 JS 解析器在技术上可能是可能的．\
但是，这非常麻烦，对于"加深对 Vue 的理解"这一目的来说并不是很重要．\
另一个原因是官方 Vue 也在这部分使用 Babel．

### magic-string

https://github.com/rich-harris/magic-string

还有另一个我想使用的库．\
这个库也被官方 Vue 使用．\
它是一个使字符串操作更容易的库．

```ts
const input = 'Hello'
const s = new MagicString(input)
```

你可以像这样生成一个实例，并使用实例提供的便利方法来操作字符串．\
以下是一些示例：

```ts
s.append('!!!') // 追加到末尾
s.prepend('message: ') // 前置到开头
s.overwrite(9, 13, 'こんにちは') // 在范围内覆写
```

没有必要强制使用它，但我将使用它来与官方 Vue 保持一致．

无论是 Babel 还是 magic-string，你现在都不需要理解实际用法．\
我稍后会解释并对齐实现，所以现在有一个粗略的理解就可以了．

## 重写脚本的默认导出

回顾当前目标：

```ts
export default {
  setup() {},
  // 其他选项
}
```

我想将上面的代码重写为：

```ts
const _sfc_main = {
  setup() {},
  // 其他选项
}

export default { ..._sfc_main, render }
```

换句话说，如果我可以从原始代码的导出语句中提取导出目标并将其分配给名为 `_sfc_main` 的变量，我将实现目标．

首先，让我们安装必要的库．

```sh
pwd # ~
pnpm add @babel/parser magic-string
```

创建一个名为 "rewriteDefault.ts" 的文件．

```sh
pwd # ~
touch packages/compiler-sfc/rewriteDefault.ts
```

确保函数 "rewriteDefault" 可以接收目标源代码作为 "input" 和要绑定的变量名作为 "as"．\
将转换后的源代码作为返回值返回．

`~/packages/compiler-sfc/rewriteDefault.ts`

```ts
export function rewriteDefault(input: string, as: string): string {
  // TODO:
  return ''
}
```

首先，让我们处理导出声明不存在的情况．\
由于没有导出，绑定一个空对象并完成．

```ts
const defaultExportRE = /((?:^|\n|;)\s*)export(\s*)default/
const namedDefaultExportRE = /((?:^|\n|;)\s*)export(.+)(?:as)?(\s*)default/s

export function rewriteDefault(input: string, as: string): string {
  if (!hasDefaultExport(input)) {
    return input + `\nconst ${as} = {}`
  }

  // TODO:
  return ''
}

export function hasDefaultExport(input: string): boolean {
  return defaultExportRE.test(input) || namedDefaultExportRE.test(input)
}
```

这里出现了 Babel 解析器和 magic-string．

```ts
import { parse } from '@babel/parser'
import MagicString from 'magic-string'
// .
// .
export function rewriteDefault(input: string, as: string): string {
  // .
  // .
  const s = new MagicString(input)
  const ast = parse(input, {
    sourceType: 'module',
  }).program.body
  // .
  // .
}
```

从这里开始，我们将基于 Babel 解析器获得的 JavaScript AST（抽象语法树）来操作字符串 `s`．\
虽然有点长，但我将在源代码的注释中提供额外的解释．\
基本上，我们遍历 AST 并基于 `type` 属性编写条件语句，并使用 `magic-string` 的方法操作字符串 `s`．

```ts
export function rewriteDefault(input: string, as: string): string {
  // .
  // .
  ast.forEach(node => {
    // 在默认导出的情况下
    if (node.type === 'ExportDefaultDeclaration') {
      if (node.declaration.type === 'ClassDeclaration') {
        // 如果是 `export default class Hoge {}`，将其替换为 `class Hoge {}`
        s.overwrite(node.start!, node.declaration.id.start!, `class `)
        // 然后，在末尾添加像 `const ${as} = Hoge;` 这样的代码。
        s.append(`\nconst ${as} = ${node.declaration.id.name}`)
      } else {
        // 对于其他默认导出，将声明部分替换为变量声明。
        // 例如 1) `export default { setup() {}, }`  ->  `const ${as} = { setup() {}, }`
        // 例如 2) `export default Hoge`  ->  `const ${as} = Hoge`
        s.overwrite(node.start!, node.declaration.start!, `const ${as} = `)
      }
    }

    // 即使在命名导出的情况下，声明中也可能有默认导出。
    // 主要有 3 种模式
    //   1. 在像 `export { default } from "source";` 这样的声明情况下
    //   2. 在像 `export { hoge as default }` from 'source' 这样的声明情况下
    //   3. 在像 `export { hoge as default }` 这样的声明情况下
    if (node.type === 'ExportNamedDeclaration') {
      for (const specifier of node.specifiers) {
        if (
          specifier.type === 'ExportSpecifier' &&
          specifier.exported.type === 'Identifier' &&
          specifier.exported.name === 'default'
        ) {
          // 如果有关键字 `from`
          if (node.source) {
            if (specifier.local.name === 'default') {
              // 1. 在像 `export { default } from "source";` 这样的声明情况下
              // 在这种情况下，将其提取到导入语句中并给它一个名称，然后将其绑定到最终变量。
              // 例如) `export { default } from "source";`  ->  `import { default as __VUE_DEFAULT__ } from 'source'; const ${as} = __VUE_DEFAULT__`
              const end = specifierEnd(input, specifier.local.end!, node.end!)
              s.prepend(
                `import { default as __VUE_DEFAULT__ } from '${node.source.value}'\n`,
              )
              s.overwrite(specifier.start!, end, ``)
              s.append(`\nconst ${as} = __VUE_DEFAULT__`)
              continue
            } else {
              // 2. 在像 `export { hoge as default }` from 'source' 这样的声明情况下
              // 在这种情况下，将所有说明符按原样重写为导入语句，并将作为默认值的变量绑定到最终变量。
              // 例如) `export { hoge as default } from "source";`  ->  `import { hoge } from 'source'; const ${as} = hoge
              const end = specifierEnd(
                input,
                specifier.exported.end!,
                node.end!,
              )
              s.prepend(
                `import { ${input.slice(
                  specifier.local.start!,
                  specifier.local.end!,
                )} } from '${node.source.value}'\n`,
              )

              // 3. 在像 `export { hoge as default }` 这样的声明情况下
              // 在这种情况下，简单地将其绑定到最终变量。
              s.overwrite(specifier.start!, end, ``)
              s.append(`\nconst ${as} = ${specifier.local.name}`)
              continue
            }
          }
          const end = specifierEnd(input, specifier.end!, node.end!)
          s.overwrite(specifier.start!, end, ``)
          s.append(`\nconst ${as} = ${specifier.local.name}`)
        }
      }
    }
  })
  return s.toString()
}

// 计算声明语句的结束
function specifierEnd(input: string, end: number, nodeEnd: number | null) {
  // export { default   , foo } ...
  let hasCommas = false
  let oldEnd = end
  while (end < nodeEnd!) {
    if (/\s/.test(input.charAt(end))) {
      end++
    } else if (input.charAt(end) === ',') {
      end++
      hasCommas = true
      break
    } else if (input.charAt(end) === '}') {
      break
    }
  }
  return hasCommas ? end : oldEnd
}
```

现在你可以重写默认导出了．\
让我们尝试在插件中使用它．

```ts
import type { Plugin } from 'vite'
import { createFilter } from 'vite'
import { parse, rewriteDefault } from '../../compiler-sfc'
import { compile } from '../../compiler-dom'

export default function vitePluginChibivue(): Plugin {
  const filter = createFilter(/\.vue$/)

  return {
    name: 'vite:chibivue',

    transform(code, id) {
      if (!filter(id)) return

      const outputs = []
      outputs.push("import * as ChibiVue from 'chibivue'")

      const { descriptor } = parse(code, { filename: id })

      // --------------------------- 从这里
      const SFC_MAIN = '_sfc_main'
      const scriptCode = rewriteDefault(
        descriptor.script?.content ?? '',
        SFC_MAIN,
      )
      outputs.push(scriptCode)
      // --------------------------- 到这里

      const templateCode = compile(descriptor.template?.content ?? '', {
        isBrowser: false,
      })
      outputs.push(templateCode)

      outputs.push('\n')
      outputs.push(`export default { ...${SFC_MAIN}, render }`) // 这里

      return { code: outputs.join('\n') }
    },
  }
}
```

在此之前，让我们做一个小修改．

`~/packages/runtime-core/component.ts`

```ts
export const setupComponent = (instance: ComponentInternalInstance) => {
  // .
  // .
  // .
  // 将组件的渲染选项添加到实例
  const { render } = component
  if (render) {
    instance.render = render as InternalRenderFunction
  }
}
```

现在你应该能够渲染了！！！

![render_sfc](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/render_sfc.png)

样式没有应用，因为不支持，但现在你可以渲染组件了．
