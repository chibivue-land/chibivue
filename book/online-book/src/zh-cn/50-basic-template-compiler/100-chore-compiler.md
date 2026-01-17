# 编译器细节优化

在本章中，我们将对模板编译器进行一些调整以提高其质量。\
主要涉及以下两个主题：

1. **空白处理** - 删除和压缩不必要的空白
2. **文本节点合并** - 高效合并相邻的文本节点

这些是为了提高生成代码质量的优化，而不是可见的功能。

## 空白处理

### 问题

在当前的实现中，模板中的所有空白都会被原样保留。\
考虑以下模板：

```html
<div>
  <span>Hello</span>
  <span>World</span>
</div>
```

在当前实现中，`<div>` 和 `<span>` 之间的换行和缩进会作为文本节点被保留。\
这会生成不必要的节点，可能影响性能。

### Vue.js 的方法

Vue.js 使用 `whitespace` 选项来控制空白的处理方式。

```ts
type WhitespaceStrategy = 'preserve' | 'condense'
```

- **`'condense'`**（默认）：压缩连续的空白并删除不必要的空白
- **`'preserve'`**：原样保留空白

### condense 模式的行为

在 condense 模式下，空白按照以下规则处理：

1. **开头/结尾的纯空白文本节点** → 删除
2. **包含换行的元素间空白** → 删除
3. **连续的空白** → 压缩为单个空格
4. **不包含换行的元素间空白** → 保留（压缩为单个空格）

示例：

```html
<div>   <span/>    </div>
<!-- 结果：只有 <span/> 作为子节点（周围的空格被删除） -->

<div/>
<div/>
<div/>
<!-- 结果：只有 3 个 div 元素（包含换行的空白被删除） -->

<span>foo</span>  <span>bar</span>
<!-- 结果：元素间的空格被保留（没有换行） -->
```

### 实现

首先，在 `ParserOptions` 中添加 `whitespace` 选项。

`packages/compiler-core/src/options.ts`：

```ts
export interface ParserOptions {
  // ... 现有选项 ...
  whitespace?: 'preserve' | 'condense' // [!code ++]
}
```

在 `packages/compiler-core/src/parse.ts` 中添加空白处理函数。

```ts
function isAllWhitespace(content: string): boolean {
  for (let i = 0; i < content.length; i++) {
    const c = content.charCodeAt(i)
    if (
      c !== 0x20 && // 空格
      c !== 0x09 && // 制表符
      c !== 0x0a && // 换行
      c !== 0x0c && // 换页
      c !== 0x0d    // 回车
    ) {
      return false
    }
  }
  return true
}

function hasNewlineChar(content: string): boolean {
  for (let i = 0; i < content.length; i++) {
    const c = content.charCodeAt(i)
    if (c === 0x0a || c === 0x0d) {
      return true
    }
  }
  return false
}

function condense(content: string): string {
  let result = ''
  let prevIsWhitespace = false
  for (let i = 0; i < content.length; i++) {
    const c = content.charCodeAt(i)
    const isWhitespace =
      c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0c || c === 0x0d
    if (isWhitespace) {
      if (!prevIsWhitespace) {
        result += ' '
        prevIsWhitespace = true
      }
    } else {
      result += content[i]
      prevIsWhitespace = false
    }
  }
  return result
}

function condenseWhitespace(
  nodes: TemplateChildNode[],
  context: ParserContext,
): TemplateChildNode[] {
  const shouldCondense = context.options.whitespace !== 'preserve'
  let removedWhitespace = false

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (node.type === NodeTypes.TEXT) {
      if (!context.inPre) {
        if (isAllWhitespace(node.content)) {
          const prev = nodes[i - 1]?.type
          const next = nodes[i + 1]?.type
          // 以下情况删除：
          // - 开头或结尾的空白
          // - (condense 模式) 注释之间的空白
          // - (condense 模式) 注释和元素之间的空白
          // - (condense 模式) 包含换行的元素间空白
          if (
            !prev ||
            !next ||
            (shouldCondense &&
              ((prev === NodeTypes.COMMENT &&
                (next === NodeTypes.COMMENT || next === NodeTypes.ELEMENT)) ||
                (prev === NodeTypes.ELEMENT &&
                  (next === NodeTypes.COMMENT ||
                    (next === NodeTypes.ELEMENT &&
                      hasNewlineChar(node.content))))))
          ) {
            removedWhitespace = true
            nodes[i] = null as any
          } else {
            // 否则压缩为单个空格
            node.content = ' '
          }
        } else if (shouldCondense) {
          // condense 模式下压缩连续空白
          node.content = condense(node.content)
        }
      }
    }
  }

  return removedWhitespace ? nodes.filter(Boolean) : nodes
}
```

然后在解析元素时调用此函数。

```ts
function parseElement(
  context: ParserContext,
  ancestors: ElementNode[],
): ElementNode | undefined {
  // ... 现有代码 ...

  // Children
  if (!element.isSelfClosing) {
    ancestors.push(element)
    const children = parseChildren(context, ancestors)
    ancestors.pop()
    element.children = condenseWhitespace(children, context) // [!code ++]
    // element.children = children // [!code --]

    // ...
  }

  return element
}
```

同样对根节点应用相同的处理。

```ts
export const baseParse = (
  content: string,
  options: ParserOptions = {},
): RootNode => {
  const context = createParserContext(content, options)
  const children = parseChildren(context, [])
  return createRoot(condenseWhitespace(children, context)) // [!code ++]
  // return createRoot(children) // [!code --]
}
```

## 文本节点合并 (transformText)

### 问题

在当前实现中，文本节点和 mustache 语法（`{{ }}`）被作为单独的节点处理。

```html
<div>abc {{ d }} {{ e }}</div>
```

这个模板有以下子节点：
- `TEXT`: "abc "
- `INTERPOLATION`: d
- `TEXT`: " "
- `INTERPOLATION`: e

在代码生成时单独处理这些节点效率不高。

### Vue.js 的方法

Vue.js 使用名为 `transformText` 的转换器将相邻的文本节点和 mustache 语法合并为一个 `CompoundExpression`。

合并后：
```ts
// "abc " + d + " " + e
createCompoundExpression(['abc ', d, ' ', e])
```

这允许在代码生成时输出高效的连接操作。

### 实现

创建 `packages/compiler-core/src/transforms/transformText.ts`。

```ts
import type { NodeTransform } from '../transform'
import {
  type CompoundExpressionNode,
  ElementTypes,
  NodeTypes,
  createCallExpression,
  createCompoundExpression,
} from '../ast'
import { isText } from '../utils'
import { CREATE_TEXT } from '../runtimeHelpers'
import { PatchFlags } from '@chibivue/shared'

// 将相邻的文本节点和 mustache 合并为单个表达式
// 例如：<div>abc {{ d }} {{ e }}</div> 应该只有一个子节点
export const transformText: NodeTransform = (node, context) => {
  if (
    node.type === NodeTypes.ROOT ||
    node.type === NodeTypes.ELEMENT ||
    node.type === NodeTypes.FOR ||
    node.type === NodeTypes.IF_BRANCH
  ) {
    // 在子节点处理完成后执行
    return () => {
      const children = node.children
      let currentContainer: CompoundExpressionNode | undefined = undefined
      let hasText = false

      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (isText(child)) {
          hasText = true
          for (let j = i + 1; j < children.length; j++) {
            const next = children[j]
            if (isText(next)) {
              if (!currentContainer) {
                currentContainer = children[i] = createCompoundExpression(
                  [child],
                  child.loc,
                )
              }
              // 合并相邻的文本节点
              currentContainer.children.push(` + `, next)
              children.splice(j, 1)
              j--
            } else {
              currentContainer = undefined
              break
            }
          }
        }
      }

      if (
        !hasText ||
        // 对于只有单个文本子节点的普通元素，保持原样
        // 运行时有直接设置 textContent 的优化路径
        (children.length === 1 &&
          (node.type === NodeTypes.ROOT ||
            (node.type === NodeTypes.ELEMENT &&
              node.tagType === ElementTypes.ELEMENT &&
              !node.props.find(
                p =>
                  p.type === NodeTypes.DIRECTIVE &&
                  !context.directiveTransforms[p.name],
              ))))
      ) {
        return
      }

      // 将文本节点转换为 createTextVNode(text) 调用
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (isText(child) || child.type === NodeTypes.COMPOUND_EXPRESSION) {
          const callArgs: any[] = []
          // createTextVNode 默认为单个空格，
          // 所以单个空格时可以省略参数
          if (child.type !== NodeTypes.TEXT || child.content !== ' ') {
            callArgs.push(child)
          }
          // 为动态文本添加标志以在块内进行补丁
          if (!context.ssr && !isStaticNode(child)) {
            callArgs.push(PatchFlags.TEXT)
          }
          children[i] = {
            type: NodeTypes.TEXT_CALL,
            content: child,
            loc: child.loc,
            codegenNode: createCallExpression(
              context.helper(CREATE_TEXT),
              callArgs,
            ),
          }
        }
      }
    }
  }
}

function isStaticNode(node: any): boolean {
  if (node.type === NodeTypes.TEXT) {
    return true
  }
  if (node.type === NodeTypes.INTERPOLATION) {
    return node.content.isStatic
  }
  if (node.type === NodeTypes.COMPOUND_EXPRESSION) {
    return node.children.every((child: any) => {
      if (typeof child === 'string') return true
      return isStaticNode(child)
    })
  }
  return false
}
```

在 `packages/compiler-core/src/utils.ts` 中添加 `isText` 辅助函数。

```ts
export function isText(
  node: TemplateChildNode,
): node is TextNode | InterpolationNode {
  return node.type === NodeTypes.TEXT || node.type === NodeTypes.INTERPOLATION
}
```

在 `packages/compiler-core/src/ast.ts` 中添加 `TEXT_CALL` 节点类型和 `createCallExpression`。

```ts
export const enum NodeTypes {
  // ... 现有类型 ...
  TEXT_CALL, // [!code ++]
}

export interface TextCallNode extends Node {
  type: NodeTypes.TEXT_CALL
  content: TextNode | InterpolationNode | CompoundExpressionNode
  codegenNode: CallExpression
}

export function createCallExpression(
  callee: string,
  args: CallExpression['arguments'] = [],
  loc: SourceLocation = locStub,
): CallExpression {
  return {
    type: NodeTypes.JS_CALL_EXPRESSION,
    loc,
    callee,
    arguments: args,
  }
}
```

在 `packages/compiler-core/src/runtimeHelpers.ts` 中添加 `CREATE_TEXT`。

```ts
export const CREATE_TEXT = Symbol('createTextVNode')

export const helperNameMap: Record<symbol, string> = {
  // ... 现有助手 ...
  [CREATE_TEXT]: 'createTextVNode',
}
```

### 注册转换器

在 `packages/compiler-core/src/compile.ts` 中注册转换器。

```ts
import { transformText } from './transforms/transformText'

export function getBaseTransformPreset(): TransformPreset {
  return [
    [
      transformElement,
      transformSlotOutlet,
      transformText, // [!code ++]
    ],
    {
      on: transformOn,
      bind: transformBind,
      if: transformIf,
      for: transformFor,
      model: transformModel,
    },
  ]
}
```

### 更新代码生成

在 `packages/compiler-core/src/codegen.ts` 中添加 `TEXT_CALL` 节点处理。

```ts
function genNode(node: any, context: CodegenContext) {
  switch (node.type) {
    // ... 现有情况 ...
    case NodeTypes.TEXT_CALL: // [!code ++]
      genNode(node.codegenNode, context) // [!code ++]
      break // [!code ++]
  }
}
```

### 更新运行时

在 `packages/runtime-core/src/vnode.ts` 中添加 `createTextVNode`。

```ts
export function createTextVNode(text: string = ' ', flag: number = 0): VNode {
  return createVNode(Text, null, text, flag)
}
```

从 `packages/runtime-core/src/index.ts` 导出。

```ts
export { createTextVNode } from './vnode'
```

## 测试

让我们用以下模板进行验证：

```vue
<script>
import { ref } from 'chibivue'

export default {
  setup() {
    const name = ref('World')
    return { name }
  },
}
</script>

<template>
  <div>
    <p>Hello {{ name }}!</p>
  </div>
</template>
```

检查编译结果时，你应该看到：
- 不必要的空白（换行和缩进）已被删除
- `Hello `、`{{ name }}` 和 `!` 已被合并

编译器的质量现在得到了提升！

本章节的源代码：\
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/100_chore_compiler)
