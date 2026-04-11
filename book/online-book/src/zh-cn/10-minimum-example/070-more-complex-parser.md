# 我想编写更复杂的 HTML

## 我想编写更复杂的 HTML

在当前状态下，我只能表达标签的名称和属性，以及文本的内容．\
因此，我想能够在模板中编写更复杂的 HTML．\
具体来说，我想能够编译这样的模板：

```ts
const app = createApp({
  template: `
    <div class="container" style="text-align: center">
      <h2>Hello, chibivue!</h2>
      <img
        width="150px"
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png"
        alt="Vue.js Logo"
      />
      <p><b>chibivue</b> is the minimal Vue.js</p>

      <style>
        .container {
          height: 100vh;
          padding: 16px;
          background-color: #becdbe;
          color: #2c3e50;
        }
      </style>
    </div>

  `,
})
app.mount('#app')
```

但是，用正则表达式解析如此复杂的 HTML 是困难的．\
所以，从这里开始，我将认真实现一个解析器．

## AST 的介绍

为了实现一个成熟的编译器，我将引入一个叫做 AST（抽象语法树）的东西．\
AST 代表抽象语法树，顾名思义，它是表示语法的树结构的数据表示．\
这是在实现各种编译器时出现的概念，不仅仅是 Vue.js．\
在许多情况下（在语言处理系统中），"解析"指的是将其转换为这种称为 AST 的表示．\
AST 的定义由每种语言定义．\
例如，您熟悉的 JavaScript 由称为 [estree](https://github.com/estree/estree) 的 AST 表示，源代码字符串根据此定义进行解析．

我试图以一种酷的方式解释它，但在图像方面，它只是我们迄今为止实现的 parse 函数返回类型的正式定义．\
目前，parse 函数的返回值如下：

```ts
type ParseResult = {
  tag: string
  props: Record<string, string>
  textContent: string
}
```

让我们扩展这个并定义它，以便可以执行更复杂的表达式．

创建一个新文件 `~/packages/compiler-core/ast.ts`．\
我将在编写代码时解释，因为它有点长．

```ts
// 这表示节点的类型。
// 应该注意的是，这里的 Node 不是指 HTML Node，而是指这个模板编译器处理的粒度。
// 所以，不仅 Element 和 Text，Attribute 也被视为一个 Node。
// 这与 Vue.js 的设计一致，在将来实现指令时会很有用。
export const enum NodeTypes {
  ELEMENT,
  TEXT,
  ATTRIBUTE,
}

// 所有 Node 都有 type 和 loc。
// loc 代表位置，保存关于这个 Node 在源代码（模板字符串）中对应位置的信息。
// （例如，哪一行和行上的哪个位置）
export interface Node {
  type: NodeTypes
  loc: SourceLocation
}

// Element 的 Node。
export interface ElementNode extends Node {
  type: NodeTypes.ELEMENT
  tag: string // 例如 "div"
  props: Array<AttributeNode> // 例如 { name: "class", value: { content: "container" } }
  children: TemplateChildNode[]
  isSelfClosing: boolean // 例如 <img /> -> true
}

// ElementNode 拥有的 Attribute。
// 它可以表达为只是 Record<string, string>，
// 但它被定义为像 Vue 一样具有 name(string) 和 value(TextNode)。
export interface AttributeNode extends Node {
  type: NodeTypes.ATTRIBUTE
  name: string
  value: TextNode | undefined
}

export type TemplateChildNode = ElementNode | TextNode

export interface TextNode extends Node {
  type: NodeTypes.TEXT
  content: string
}

// 关于位置的信息。
// Node 有这个信息。
// start 和 end 包含位置信息。
// source 包含实际代码（字符串）。
export interface SourceLocation {
  start: Position
  end: Position
  source: string
}

export interface Position {
  offset: number // 从文件开始
  line: number
  column: number
}
```

这是我们这次将要处理的 AST．\
在 parse 函数中，我们将实现将模板字符串转换为这个 AST．

## 成熟解析器的实现

::: warning
在 2023 年 11 月下旬，在 [vuejs/core#9674](https://github.com/vuejs/core/pull/9674) 中进行了性能改进的重大重写．  
这些更改在 2023 年 12 月下旬作为 [Vue 3.4](https://blog.vuejs.org/posts/vue-3-4) 发布．  
请注意，这本在线书籍参考的是此重写之前的实现．  
我们计划在适当的时机相应地更新这本在线书籍．
:::

在 `~/packages/compiler-core/parse.ts` 中实现它．
即使我说它是成熟的，你也不必太紧张．\
基本上，你所做的就是在读取字符串时生成 AST，并使用分支和循环．\
源代码会有点长，但我认为在代码库中解释会更容易理解．所以让我们这样进行．\
请通过阅读源代码来尝试理解细节．

删除您迄今为止实现的 baseParse 的内容，并按如下方式更改返回类型：

```ts
import { TemplateChildNode } from './ast'

export const baseParse = (
  content: string,
): { children: TemplateChildNode[] } => {
  // TODO:
  return { children: [] }
}
```

## Context

首先，让我们实现解析期间使用的状态．
\我们将其命名为 `ParserContext`，并在解析期间在这里收集必要的信息．\
最终，我认为它也会保存解析器配置选项等．

```ts
export interface ParserContext {
  // 原始模板字符串
  readonly originalSource: string

  source: string

  // 此解析器正在读取的当前位置
  offset: number
  line: number
  column: number
}

function createParserContext(content: string): ParserContext {
  return {
    originalSource: content,
    source: content,
    column: 1,
    line: 1,
    offset: 0,
  }
}

export const baseParse = (
  content: string,
): { children: TemplateChildNode[] } => {
  const context = createParserContext(content) // 创建上下文

  // TODO:
  return { children: [] }
}
```

## parseChildren

在顺序方面，解析按如下方式进行：(parseChildren) -> (parseElement 或 parseText)．

虽然有点长，但让我们从 parseChildren 的实现开始．\
解释将在源代码的注释中完成．

```ts
export const baseParse = (
  content: string,
): { children: TemplateChildNode[] } => {
  const context = createParserContext(content)
  const children = parseChildren(context, []) // 解析子节点
  return { children: children }
}

function parseChildren(
  context: ParserContext,

  // 由于 HTML 具有递归结构，我们将祖先元素保持为堆栈，并在每次嵌套到子元素中时推送它们。
  // 当找到结束标签时，parseChildren 结束并弹出祖先。
  ancestors: ElementNode[],
): TemplateChildNode[] {
  const nodes: TemplateChildNode[] = []

  while (!isEnd(context, ancestors)) {
    const s = context.source
    let node: TemplateChildNode | undefined = undefined

    if (s[0] === '<') {
      // 如果 s 以 "<" 开头且下一个字符是字母，则将其解析为元素。
      if (/[a-z]/i.test(s[1])) {
        node = parseElement(context, ancestors) // TODO: 稍后实现这个。
      }
    }

    if (!node) {
      // 如果不匹配上述条件，则将其解析为 TextNode。
      node = parseText(context) // TODO: 稍后实现这个。
    }

    pushNode(nodes, node)
  }

  return nodes
}

// 确定解析子元素的 while 循环结束的函数
function isEnd(context: ParserContext, ancestors: ElementNode[]): boolean {
  const s = context.source

  // 如果 s 以 "</" 开头且祖先的标签名跟随，它确定是否有闭合标签（parseChildren 是否应该结束）。
  if (startsWith(s, '</')) {
    for (let i = ancestors.length - 1; i >= 0; --i) {
      if (startsWithEndTagOpen(s, ancestors[i].tag)) {
        return true
      }
    }
  }

  return !s
}

function startsWith(source: string, searchString: string): boolean {
  return source.startsWith(searchString)
}

function pushNode(nodes: TemplateChildNode[], node: TemplateChildNode): void {
  // 如果 Text 类型的节点是连续的，它们会被合并。
  if (node.type === NodeTypes.TEXT) {
    const prev = last(nodes)
    if (prev && prev.type === NodeTypes.TEXT) {
      prev.content += node.content
      return
    }
  }

  nodes.push(node)
}

function last<T>(xs: T[]): T | undefined {
  return xs[xs.length - 1]
}

function startsWithEndTagOpen(source: string, tag: string): boolean {
  return (
    startsWith(source, '</') &&
    source.slice(2, 2 + tag.length).toLowerCase() === tag.toLowerCase() &&
    /[\t\r\n\f />]/.test(source[2 + tag.length] || '>')
  )
}
```

接下来，让我们实现 parseElement 和 parseText．

::: tip 关于 isEnd 循环
在 isEnd 中，有一个循环过程，使用 startsWithEndTagOpen 检查 's' 是否以 ancestors 数组中每个元素的闭合标签开头．

```ts
function isEnd(context: ParserContext, ancestors: ElementNode[]): boolean {
  const s = context.source

  // 如果 s 以 </ 开头且祖先的标签名跟随，它确定是否有闭合标签（parseChildren 是否应该结束）。
  if (startsWith(s, '</')) {
    for (let i = ancestors.length - 1; i >= 0; --i) {
      if (startsWithEndTagOpen(s, ancestors[i].tag)) {
        return true
      }
    }
  }

  return !s
}
```

但是，如果您需要检查 's' 是否以闭合标签开头，只检查 ancestors 中的最后一个元素应该就足够了．\
虽然这部分代码在解析器的最近重写中被消除了，但将 Vue 3.3 代码修改为只检查 ancestors 中的最后一个元素仍然会导致所有正面测试成功通过．
:::

## parseText

首先，让我们从简单的 parseText 开始．\
它有点长，因为它还实现了一些不仅在 parseText 中使用，而且在其他函数中也使用的实用程序．

```ts
function parseText(context: ParserContext): TextNode {
  // 读取直到 "<"（无论它是开始还是结束标签），并根据读取了多少字符计算 Text 数据结束点的索引。
  const endToken = '<'
  let endIndex = context.source.length
  const index = context.source.indexOf(endToken, 1)
  if (index !== -1 && endIndex > index) {
    endIndex = index
  }

  const start = getCursor(context) // 用于 loc

  // 根据 endIndex 的信息解析 Text 数据。
  const content = parseTextData(context, endIndex)

  return {
    type: NodeTypes.TEXT,
    content,
    loc: getSelection(context, start),
  }
}

// 根据内容和长度提取文本。
function parseTextData(context: ParserContext, length: number): string {
  const rawText = context.source.slice(0, length)
  advanceBy(context, length)
  return rawText
}

// -------------------- 以下是实用程序（也在 parseElement 等中使用） --------------------

function advanceBy(context: ParserContext, numberOfCharacters: number): void {
  const { source } = context
  advancePositionWithMutation(context, source, numberOfCharacters)
  context.source = source.slice(numberOfCharacters)
}

function advanceSpaces(context: ParserContext): void {
  const match = /^[\t\r\n\f ]+/.exec(context.source);
  if (match) {
    advanceBy(context, match[0].length);
  }
}

// 虽然有点长，但它只是计算位置。
// 它破坏性地更新作为参数接收的 pos 对象。
function advancePositionWithMutation(
  pos: Position,
  source: string,
  numberOfCharacters: number = source.length,
): Position {
  let linesCount = 0
  let lastNewLinePos = -1
  for (let i = 0; i < numberOfCharacters; i++) {
    if (source.charCodeAt(i) === 10 /* newline char code */) {
      linesCount++
      lastNewLinePos = i
    }
  }

  pos.offset += numberOfCharacters
  pos.line += linesCount
  pos.column =
    lastNewLinePos === -1
      ? pos.column + numberOfCharacters
      : numberOfCharacters - lastNewLinePos

  return pos
}

function getCursor(context: ParserContext): Position {
  const { column, line, offset } = context
  return { column, line, offset }
}

function getSelection(
  context: ParserContext,
  start: Position,
  end?: Position,
): SourceLocation {
  end = end || getCursor(context)
  return {
    start,
    end,
    source: context.originalSource.slice(start.offset, end.offset),
  }
}
```

## parseElement

接下来是元素的解析．
元素的解析主要包括解析开始标签，解析子节点和解析结束标签．\
开始标签的解析进一步分为标签名和属性．\
让我们首先创建一个框架来解析开始标签的前半部分，子节点和结束标签．

```ts
const enum TagType {
  Start,
  End,
}

function parseElement(
  context: ParserContext,
  ancestors: ElementNode[],
): ElementNode | undefined {
  // 开始标签。
  const element = parseTag(context, TagType.Start) // TODO:

  // 如果它是像 <img /> 这样的自闭合元素，我们在这里结束（因为没有子元素或结束标签）。
  if (element.isSelfClosing) {
    return element
  }

  // 子元素。
  ancestors.push(element)
  const children = parseChildren(context, ancestors)
  ancestors.pop()

  element.children = children

  // 结束标签。
  if (startsWithEndTagOpen(context.source, element.tag)) {
    parseTag(context, TagType.End) // TODO:
  }

  return element
}
```

这里没有什么特别困难的．\
`parseChildren` 函数是递归的（因为 `parseElement` 被 `parseChildren` 调用）．\
我们在前后操作 `ancestors` 数据结构作为堆栈．

让我们实现 `parseTag`．

```ts
function parseTag(context: ParserContext, type: TagType): ElementNode {
  // 标签打开。
  const start = getCursor(context)
  const match = /^<\/?([a-z][^\t\r\n\f />]*)/i.exec(context.source)!
  const tag = match[1]

  advanceBy(context, match[0].length)
  advanceSpaces(context)

  // 属性。
  let props = parseAttributes(context, type)

  // 标签关闭。
  let isSelfClosing = false

  // 如果下一个字符是 "/>"，它是一个自闭合标签。
  isSelfClosing = startsWith(context.source, '/>')
  advanceBy(context, isSelfClosing ? 2 : 1)

  return {
    type: NodeTypes.ELEMENT,
    tag,
    props,
    children: [],
    isSelfClosing,
    loc: getSelection(context, start),
  }
}

// 解析整个属性（多个属性）。
// 例如 `id="app" class="container" style="color: red"`
function parseAttributes(
  context: ParserContext,
  type: TagType,
): AttributeNode[] {
  const props = []
  const attributeNames = new Set<string>()

  // 继续读取直到标签结束。
  while (
    context.source.length > 0 &&
    !startsWith(context.source, '>') &&
    !startsWith(context.source, '/>')
  ) {
    const attr = parseAttribute(context, attributeNames)

    if (type === TagType.Start) {
      props.push(attr)
    }

    advanceSpaces(context) // 跳过空格。
  }

  return props
}

type AttributeValue =
  | {
      content: string
      loc: SourceLocation
    }
  | undefined

// 解析单个属性。
// 例如 `id="app"`
function parseAttribute(
  context: ParserContext,
  nameSet: Set<string>,
): AttributeNode {
  // 名称。
  const start = getCursor(context)
  const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source)!
  const name = match[0]

  nameSet.add(name)

  advanceBy(context, name.length)

  // 值
  let value: AttributeValue = undefined

  if (/^[\t\r\n\f ]*=/.test(context.source)) {
    advanceSpaces(context)
    advanceBy(context, 1)
    advanceSpaces(context)
    value = parseAttributeValue(context)
  }

  const loc = getSelection(context, start)

  return {
    type: NodeTypes.ATTRIBUTE,
    name,
    value: value && {
      type: NodeTypes.TEXT,
      content: value.content,
      loc: value.loc,
    },
    loc,
  }
}

// 解析属性的值。
// 此实现允许解析值，无论它们是单引号还是双引号。
// 它只是提取引号中包含的值。
function parseAttributeValue(context: ParserContext): AttributeValue {
  const start = getCursor(context)
  let content: string

  const quote = context.source[0]
  const isQuoted = quote === `"` || quote === `'`
  if (isQuoted) {
    // 引用值。
    advanceBy(context, 1)

    const endIndex = context.source.indexOf(quote)
    if (endIndex === -1) {
      content = parseTextData(context, context.source.length)
    } else {
      content = parseTextData(context, endIndex)
      advanceBy(context, 1)
    }
  } else {
    // 未引用
    const match = /^[^\t\r\n\f >]+/.exec(context.source)
    if (!match) {
      return undefined
    }
    content = parseTextData(context, match[0].length)
  }

  return { content, loc: getSelection(context, start) }
}
```

## 完成解析器实现后

我写了很多代码，比平时多．（最多只有大约 300 行）\
我认为在这里阅读实现比用特殊词汇解释更好，所以请反复阅读．\
虽然我写了很多，但基本上它是通过读取字符串推进分析的直接任务，没有特别困难的技术．

到现在，您应该能够生成 AST．让我们检查解析是否正常工作．\
但是，由于 codegen 部分尚未实现，我们这次将输出到控制台进行确认．

```ts
const app = createApp({
  template: `
    <div class="container" style="text-align: center">
      <h2>Hello, chibivue!</h2>
      <img
        width="150px"
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png"
        alt="Vue.js Logo"
      />
      <p><b>chibivue</b> is the minimal Vue.js</p>

      <style>
        .container {
          height: 100vh;
          padding: 16px;
          background-color: #becdbe;
          color: #2c3e50;
        }
      </style>
    </div>
  `,
})
app.mount('#app')
```

`~/packages/compiler-core/compile.ts`

```ts
export function baseCompile(template: string) {
  const parseResult = baseParse(template.trim()) // 修剪模板
  console.log(
    '🚀 ~ file: compile.ts:6 ~ baseCompile ~ parseResult:',
    parseResult,
  )

  // TODO: codegen
  // const code = generate(parseResult);
  // return code;
  return ''
}
```

屏幕不会显示任何内容，但让我们检查控制台．

![AST output for complex HTML](/figures/10-minimum-example/more-complex-parser/complex-html-ast.png)

看起来解析进展顺利．\
现在，让我们基于生成的 AST 继续实现 codegen．

## 基于 AST 生成渲染函数

现在我们已经实现了一个成熟的解析器，让我们创建一个可以应用于它的代码生成器．\
但是，在这一点上，不需要复杂的实现．\
我将首先向您展示代码．

```ts
import { ElementNode, NodeTypes, TemplateChildNode, TextNode } from './ast'

export const generate = ({
  children,
}: {
  children: TemplateChildNode[]
}): string => {
  return `return function render() {
  const { h } = ChibiVue;
  return ${genNode(children[0])};
}`
}

const genNode = (node: TemplateChildNode): string => {
  switch (node.type) {
    case NodeTypes.ELEMENT:
      return genElement(node)
    case NodeTypes.TEXT:
      return genText(node)
    default:
      return ''
  }
}

const genElement = (el: ElementNode): string => {
  return `h("${el.tag}", {${el.props
    .map(({ name, value }) => `${name}: "${value?.content}"`)
    .join(', ')}}, [${el.children.map(it => genNode(it)).join(', ')}])`
}

const genText = (text: TextNode): string => {
  return `\`${text.content}\``
}
```

使用上述代码，您可以创建有效的东西．\
取消注释解析器章节中被注释掉的部分并检查实际操作．\
`~/packages/compiler-core/compile.ts`

```ts
export function baseCompile(template: string) {
  const parseResult = baseParse(template.trim())
  const code = generate(parseResult)
  return code
}
```

playground

```ts
import { createApp } from 'chibivue'

const app = createApp({
  template: `
    <div class="container" style="text-align: center">
      <h2>Hello, chibivue!</h2>
      <img
        width="150px"
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png"
        alt="Vue.js Logo"
      />
      <p><b>chibivue</b> is the minimal Vue.js</p>

      <style>
        .container {
          height: 100vh;
          padding: 16px;
          background-color: #becdbe;
          color: #2c3e50;
        }
      </style>
    </div>
  `,
})

app.mount('#app')
```

![Rendered template result in the browser](/figures/10-minimum-example/more-complex-parser/render-template-result.png)

怎么样？看起来我们可以很好地渲染屏幕．

让我们为屏幕添加一些动作．\
由于我们还没有实现模板绑定，我们将直接操作 DOM．

```ts
export type ComponentOptions = {
  // .
  // .
  // .
  setup?: (
    props: Record<string, any>,
    ctx: { emit: (event: string, ...args: any[]) => void },
  ) => Function | void // 也允许 void
  // .
  // .
  // .
}
```

```ts
import { createApp } from 'chibivue'

const app = createApp({
  setup() {
    // 使用 Promise.resolve 延迟处理，以便在挂载后可以执行 DOM 操作
    Promise.resolve().then(() => {
      const btn = document.getElementById('btn')
      btn &&
        btn.addEventListener('click', () => {
          const h2 = document.getElementById('hello')
          h2 && (h2.textContent += '!')
        })
    })
  },

  template: `
    <div class="container" style="text-align: center">
      <h2 id="hello">Hello, chibivue!</h2>
      <img
        width="150px"
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png"
        alt="Vue.js Logo"
      />
      <p><b>chibivue</b> is the minimal Vue.js</p>

      <button id="btn"> click me! </button>

      <style>
        .container {
          height: 100vh;
          padding: 16px;
          background-color: #becdbe;
          color: #2c3e50;
        }
      </style>
    </div>
  `,
})

app.mount('#app')
```

让我们确保它正常工作．\
怎么样？虽然功能有限，但它越来越接近通常的 Vue 开发者接口．

到此为止的源代码：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/060_template_compiler2)
