# 实现注释

## 目标开发者接口

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

无需进一步解释．

## AST 和解析器的实现

关于如何实现注释，乍一看，似乎我们可以在解析时简单地忽略它．

然而，在 Vue 中，模板中编写的注释会按原样作为 HTML 输出．

换句话说，注释也需要被渲染，所以需要在 VNode 上有一个表示，编译器也需要输出该代码．
此外，还需要一个生成注释节点的操作．

首先，让我们实现 AST 和解析器．

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

现在，让我们抛出一个错误．

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
    throw new Error('EOF_IN_COMMENT') // TODO: 错误处理
  } else {
    if (match.index <= 3) {
      throw new Error('ABRUPT_CLOSING_OF_EMPTY_COMMENT') // TODO: 错误处理
    }
    if (match[1]) {
      throw new Error('INCORRECTLY_CLOSED_COMMENT') // TODO: 错误处理
    }
    content = context.source.slice(4, match.index)

    const s = context.source.slice(0, match.index)
    let prevIndex = 1,
      nestedIndex = 0
    while ((nestedIndex = s.indexOf('<!--', prevIndex)) !== -1) {
      advanceBy(context, nestedIndex - prevIndex + 1)
      if (nestedIndex + 4 < s.length) {
        throw new Error('NESTED_COMMENT') // TODO: 错误处理
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

## 代码生成

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

实现一个名为 createCommentVNode 的函数并将其作为辅助函数公开．

在 codegen 中，生成调用 createCommentVNode 的代码．

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

让我们实现渲染器．

像往常一样，在 patch 中分支 Comment 的情况，并在挂载时生成注释．

关于 patch，由于这次是静态的，我不会做任何特殊的事情．（在代码中，它只是设置为按原样分配．）

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
      (n2.el = hostCreateComment((n2.children as string) || '')), // 在 nodeOps 端实现 hostCreateComment！
      container,
      anchor,
    )
  } else {
    n2.el = n1.el
  }
}
```

好了，你现在应该已经实现了注释．让我们检查实际操作！

到此为止的源代码：[GitHub](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/035_comment)
