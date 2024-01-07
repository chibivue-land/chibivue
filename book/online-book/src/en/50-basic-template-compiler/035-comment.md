# Implementing Comment Out

## Target Developer Interface

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

There is no need for further explanation.

## Implementation of AST and Parser

As for how to implement comment out, at first glance, it seems that we can simply ignore it when parsing.

However, in Vue, comment outs written in the template are output as HTML as they are.

In other words, comment outs also need to be rendered, so it is necessary to have a representation on the VNode and the compiler also needs to output that code.
In addition, an operation to generate a comment node is also necessary.

First, let's implement the AST and parser.

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

### Parser

For now, let's throw an error.

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
    throw new Error('EOF_IN_COMMENT') // TODO: error handling
  } else {
    if (match.index <= 3) {
      throw new Error('ABRUPT_CLOSING_OF_EMPTY_COMMENT') // TODO: error handling
    }
    if (match[1]) {
      throw new Error('INCORRECTLY_CLOSED_COMMENT') // TODO: error handling
    }
    content = context.source.slice(4, match.index)

    const s = context.source.slice(0, match.index)
    let prevIndex = 1,
      nestedIndex = 0
    while ((nestedIndex = s.indexOf('<!--', prevIndex)) !== -1) {
      advanceBy(context, nestedIndex - prevIndex + 1)
      if (nestedIndex + 4 < s.length) {
        throw new Error('NESTED_COMMENT') // TODO: error handling
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

## Generating Code

Add a VNode that represents Comment to the runtime-core.

```ts
export const Comment = Symbol()
export type VNodeTypes =
  | string
  | Component
  | typeof Text
  | typeof Comment
  | typeof Fragment
```

Implement a function called createCommentVNode and expose it as a helper.

In codegen, generate the code that calls createCommentVNode.

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

## Rendering

Let's implement the renderer.

As usual, branch the case of Comment in patch and generate a comment when mounting.

Regarding the patch, since it's static this time, I won't be doing anything special. (In the code, it's just set to assign as is.)

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
      (n2.el = hostCreateComment((n2.children as string) || '')), // Implement hostCreateComment on the nodeOps side!
      container,
      anchor,
    )
  } else {
    n2.el = n1.el
  }
}
```

Well, you should have implemented comment out by now. Let's check the actual operation!

Source code up to this point: [GitHub](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/50_basic_template_compiler/035_comment)
