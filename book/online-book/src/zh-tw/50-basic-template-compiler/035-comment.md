# 實現註釋

## 目標開發者介面

```ts
import { createApp, defineComponent } from 'chibivue'

const App = defineComponent({
  template: `
  <!-- this is header. -->
  <header>header</header>

  <!-- 
    this is main.
    main content is here!
  -->
  <main>main</main>

  <!-- this is footer -->
  <footer>footer</footer>`,
})

const app = createApp(App)

app.mount('#app')
```

無需進一步解釋．

## AST 和解析器的實現

關於如何實現註釋，乍一看，似乎我們可以在解析時簡單地忽略它．

然而，在 Vue 中，模板中編寫的註釋會按原樣作為 HTML 輸出．

換句話說，註釋也需要被渲染，所以需要在 VNode 上有一個表示，編譯器也需要輸出該程式碼．
此外，還需要一個生成註釋節點的操作．

首先，讓我們實現 AST 和解析器．

### AST

```ts
export const enum NodeTypes {
  // .
  // .
  COMMENT,
  // .
  // .
  // .
}

export interface CommentNode extends Node {
  type: NodeTypes.COMMENT
  content: string
}

export type TemplateChildNode =
  | ElementNode
  | TextNode
  | InterpolationNode
  | CommentNode
```

### 解析器

現在，讓我們拋出一個錯誤．

```ts
function parseChildren(
  context: ParserContext,
  ancestors: ElementNode[],
): TemplateChildNode[] {
  // .
  // .
  // .
  if (startsWith(s, '{{')) {
    node = parseInterpolation(context)
  } else if (s[0] === '<') {
    if (s[1] === '!') {
      // https://html.spec.whatwg.org/multipage/parsing.html#markup-declaration-open-state
      if (startsWith(s, '<!--')) {
        node = parseComment(context)
      }
    } else if (/[a-z]/i.test(s[1])) {
      node = parseElement(context, ancestors)
    }
  }
  // .
  // .
  // .
}

function parseComment(context: ParserContext): CommentNode {
  const start = getCursor(context)
  let content: string

  // Regular comment.
  const match = /--(\!)?>/.exec(context.source)
  if (!match) {
    content = context.source.slice(4)
    advanceBy(context, context.source.length)
    throw new Error('EOF_IN_COMMENT') // TODO: 錯誤處理
  } else {
    if (match.index <= 3) {
      throw new Error('ABRUPT_CLOSING_OF_EMPTY_COMMENT') // TODO: 錯誤處理
    }
    if (match[1]) {
      throw new Error('INCORRECTLY_CLOSED_COMMENT') // TODO: 錯誤處理
    }
    content = context.source.slice(4, match.index)

    const s = context.source.slice(0, match.index)
    let prevIndex = 1,
      nestedIndex = 0
    while ((nestedIndex = s.indexOf('<!--', prevIndex)) !== -1) {
      advanceBy(context, nestedIndex - prevIndex + 1)
      if (nestedIndex + 4 < s.length) {
        throw new Error('NESTED_COMMENT') // TODO: 錯誤處理
      }
      prevIndex = nestedIndex + 1
    }
    advanceBy(context, match.index + match[0].length - prevIndex + 1)
  }

  return {
    type: NodeTypes.COMMENT,
    content,
    loc: getSelection(context, start),
  }
}
```

## 程式碼生成

向 runtime-core 添加表示 Comment 的 VNode．

```ts
export const Comment = Symbol()
export type VNodeTypes =
  | string
  | Component
  | typeof Text
  | typeof Comment
  | typeof Fragment
```

實現一個名為 createCommentVNode 的函式並將其作為輔助函式公開．

在 codegen 中，生成呼叫 createCommentVNode 的程式碼．

```ts
export function createCommentVNode(text: string = ''): VNode {
  return createVNode(Comment, null, text)
}
```

```ts
const genNode = (
  node: CodegenNode,
  context: CodegenContext,
  option: CompilerOptions,
) => {
  switch (node.type) {
    // .
    // .
    // .
    case NodeTypes.COMMENT:
      genComment(node, context)
      break
    // .
    // .
    // .
  }
}

function genComment(node: CommentNode, context: CodegenContext) {
  const { push, helper } = context
  push(`${helper(CREATE_COMMENT)}(${JSON.stringify(node.content)})`, node)
}
```

## 渲染

讓我們實現渲染器．

像往常一樣，在 patch 中分支 Comment 的情況，並在掛載時生成註釋．

關於 patch，由於這次是靜態的，我不會做任何特殊的事情．（在程式碼中，它只是設置為按原樣分配．）

```ts
const patch = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
  anchor: RendererElement | null,
  parentComponent: ComponentInternalInstance | null,
) => {
  const { type, ref, shapeFlag } = n2
  if (type === Text) {
    processText(n1, n2, container, anchor)
  } else if (type === Comment) {
    processCommentNode(n1, n2, container, anchor)
  } //.
  //.
  //.
}

const processCommentNode = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
  anchor: RendererElement | null,
) => {
  if (n1 == null) {
    hostInsert(
      (n2.el = hostCreateComment((n2.children as string) || '')), // 在 nodeOps 端實現 hostCreateComment！
      container,
      anchor,
    )
  } else {
    n2.el = n1.el
  }
}
```

好了，你現在應該已經實現了註釋．讓我們檢查實際操作！

到此為止的原始碼：[GitHub](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/035_comment)
