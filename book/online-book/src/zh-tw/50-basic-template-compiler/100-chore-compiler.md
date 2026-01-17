# 編譯器細節優化

在本章中，我們將對模板編譯器進行一些調整以提高其品質。\
主要涉及以下兩個主題：

1. **空白處理** - 刪除和壓縮不必要的空白
2. **文字節點合併** - 高效合併相鄰的文字節點

這些是為了提高生成程式碼品質的優化，而不是可見的功能。

## 空白處理

### 問題

在當前的實現中，模板中的所有空白都會被原樣保留。\
考慮以下模板：

```html
<div>
  <span>Hello</span>
  <span>World</span>
</div>
```

在當前實現中，`<div>` 和 `<span>` 之間的換行和縮排會作為文字節點被保留。\
這會生成不必要的節點，可能影響效能。

### Vue.js 的方法

Vue.js 使用 `whitespace` 選項來控制空白的處理方式。

```ts
type WhitespaceStrategy = 'preserve' | 'condense'
```

- **`'condense'`**（預設）：壓縮連續的空白並刪除不必要的空白
- **`'preserve'`**：原樣保留空白

### condense 模式的行為

在 condense 模式下，空白按照以下規則處理：

1. **開頭/結尾的純空白文字節點** → 刪除
2. **包含換行的元素間空白** → 刪除
3. **連續的空白** → 壓縮為單個空格
4. **不包含換行的元素間空白** → 保留（壓縮為單個空格）

範例：

```html
<div>   <span/>    </div>
<!-- 結果：只有 <span/> 作為子節點（周圍的空格被刪除） -->

<div/>
<div/>
<div/>
<!-- 結果：只有 3 個 div 元素（包含換行的空白被刪除） -->

<span>foo</span>  <span>bar</span>
<!-- 結果：元素間的空格被保留（沒有換行） -->
```

### 實現

首先，在 `ParserOptions` 中添加 `whitespace` 選項。

`packages/compiler-core/src/options.ts`：

```ts
export interface ParserOptions {
  // ... 現有選項 ...
  whitespace?: 'preserve' | 'condense' // [!code ++]
}
```

在 `packages/compiler-core/src/parse.ts` 中添加空白處理函數。

```ts
function isAllWhitespace(content: string): boolean {
  for (let i = 0; i < content.length; i++) {
    const c = content.charCodeAt(i)
    if (
      c !== 0x20 && // 空格
      c !== 0x09 && // 製表符
      c !== 0x0a && // 換行
      c !== 0x0c && // 換頁
      c !== 0x0d    // 回車
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
          // 以下情況刪除：
          // - 開頭或結尾的空白
          // - (condense 模式) 註釋之間的空白
          // - (condense 模式) 註釋和元素之間的空白
          // - (condense 模式) 包含換行的元素間空白
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
            // 否則壓縮為單個空格
            node.content = ' '
          }
        } else if (shouldCondense) {
          // condense 模式下壓縮連續空白
          node.content = condense(node.content)
        }
      }
    }
  }

  return removedWhitespace ? nodes.filter(Boolean) : nodes
}
```

然後在解析元素時呼叫此函數。

```ts
function parseElement(
  context: ParserContext,
  ancestors: ElementNode[],
): ElementNode | undefined {
  // ... 現有程式碼 ...

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

同樣對根節點應用相同的處理。

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

## 文字節點合併 (transformText)

### 問題

在當前實現中，文字節點和 mustache 語法（`{{ }}`）被作為單獨的節點處理。

```html
<div>abc {{ d }} {{ e }}</div>
```

這個模板有以下子節點：
- `TEXT`: "abc "
- `INTERPOLATION`: d
- `TEXT`: " "
- `INTERPOLATION`: e

在程式碼生成時單獨處理這些節點效率不高。

### Vue.js 的方法

Vue.js 使用名為 `transformText` 的轉換器將相鄰的文字節點和 mustache 語法合併為一個 `CompoundExpression`。

合併後：
```ts
// "abc " + d + " " + e
createCompoundExpression(['abc ', d, ' ', e])
```

這允許在程式碼生成時輸出高效的連接操作。

### 實現

建立 `packages/compiler-core/src/transforms/transformText.ts`。

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

// 將相鄰的文字節點和 mustache 合併為單個表達式
// 例如：<div>abc {{ d }} {{ e }}</div> 應該只有一個子節點
export const transformText: NodeTransform = (node, context) => {
  if (
    node.type === NodeTypes.ROOT ||
    node.type === NodeTypes.ELEMENT ||
    node.type === NodeTypes.FOR ||
    node.type === NodeTypes.IF_BRANCH
  ) {
    // 在子節點處理完成後執行
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
              // 合併相鄰的文字節點
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
        // 對於只有單個文字子節點的普通元素，保持原樣
        // 執行時有直接設定 textContent 的優化路徑
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

      // 將文字節點轉換為 createTextVNode(text) 呼叫
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (isText(child) || child.type === NodeTypes.COMPOUND_EXPRESSION) {
          const callArgs: any[] = []
          // createTextVNode 預設為單個空格，
          // 所以單個空格時可以省略參數
          if (child.type !== NodeTypes.TEXT || child.content !== ' ') {
            callArgs.push(child)
          }
          // 為動態文字添加標誌以在區塊內進行補丁
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

在 `packages/compiler-core/src/utils.ts` 中添加 `isText` 輔助函數。

```ts
export function isText(
  node: TemplateChildNode,
): node is TextNode | InterpolationNode {
  return node.type === NodeTypes.TEXT || node.type === NodeTypes.INTERPOLATION
}
```

在 `packages/compiler-core/src/ast.ts` 中添加 `TEXT_CALL` 節點類型和 `createCallExpression`。

```ts
export const enum NodeTypes {
  // ... 現有類型 ...
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
  // ... 現有助手 ...
  [CREATE_TEXT]: 'createTextVNode',
}
```

### 註冊轉換器

在 `packages/compiler-core/src/compile.ts` 中註冊轉換器。

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

### 更新程式碼生成

在 `packages/compiler-core/src/codegen.ts` 中添加 `TEXT_CALL` 節點處理。

```ts
function genNode(node: any, context: CodegenContext) {
  switch (node.type) {
    // ... 現有情況 ...
    case NodeTypes.TEXT_CALL: // [!code ++]
      genNode(node.codegenNode, context) // [!code ++]
      break // [!code ++]
  }
}
```

### 更新執行時

在 `packages/runtime-core/src/vnode.ts` 中添加 `createTextVNode`。

```ts
export function createTextVNode(text: string = ' ', flag: number = 0): VNode {
  return createVNode(Text, null, text, flag)
}
```

從 `packages/runtime-core/src/index.ts` 導出。

```ts
export { createTextVNode } from './vnode'
```

## 測試

讓我們用以下模板進行驗證：

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

檢查編譯結果時，你應該看到：
- 不必要的空白（換行和縮排）已被刪除
- `Hello `、`{{ name }}` 和 `!` 已被合併

編譯器的品質現在得到了提升！

本章節的原始碼：\
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/100_chore_compiler)
