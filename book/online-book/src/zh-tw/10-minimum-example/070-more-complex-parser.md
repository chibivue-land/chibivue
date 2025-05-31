# 我想編寫更複雜的 HTML

## 我想編寫更複雜的 HTML

在當前狀態下，我只能表達標籤的名稱和屬性，以及文字的內容．\
因此，我想能夠在模板中編寫更複雜的 HTML．\
具體來說，我想能夠編譯這樣的模板：

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

但是，用正規表示式解析如此複雜的 HTML 是困難的．\
所以，從這裡開始，我將認真實現一個解析器．

## AST 的介紹

為了實現一個成熟的編譯器，我將引入一個叫做 AST（抽象語法樹）的東西．\
AST 代表抽象語法樹，顧名思義，它是表示語法的樹結構的資料表示．\
這是在實現各種編譯器時出現的概念，不僅僅是 Vue.js．\
在許多情況下（在語言處理系統中），「解析」指的是將其轉換為這種稱為 AST 的表示．\
AST 的定義由每種語言定義．\
例如，您熟悉的 JavaScript 由稱為 [estree](https://github.com/estree/estree) 的 AST 表示，原始碼字串根據此定義進行解析．

我試圖以一種酷的方式解釋它，但在圖像方面，它只是我們迄今為止實現的 parse 函式返回類型的正式定義．\
目前，parse 函式的返回值如下：

```ts
type ParseResult = {
  tag: string
  props: Record<string, string>
  textContent: string
}
```

讓我們擴展這個並定義它，以便可以執行更複雜的表達式．

創建一個新檔案 `~/packages/compiler-core/ast.ts`．\
我將在編寫程式碼時解釋，因為它有點長．

```ts
// 這表示節點的類型。
// 應該注意的是，這裡的 Node 不是指 HTML Node，而是指這個模板編譯器處理的粒度。
// 所以，不僅 Element 和 Text，Attribute 也被視為一個 Node。
// 這與 Vue.js 的設計一致，在將來實現指令時會很有用。
export const enum NodeTypes {
  ELEMENT,
  TEXT,
  ATTRIBUTE,
}

// 所有 Node 都有 type 和 loc。
// loc 代表位置，保存關於這個 Node 在原始碼（模板字串）中對應位置的資訊。
// （例如，哪一行和行上的哪個位置）
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

// ElementNode 擁有的 Attribute。
// 它可以表達為只是 Record<string, string>，
// 但它被定義為像 Vue 一樣具有 name(string) 和 value(TextNode)。
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

// 關於位置的資訊。
// Node 有這個資訊。
// start 和 end 包含位置資訊。
// source 包含實際程式碼（字串）。
export interface SourceLocation {
  start: Position
  end: Position
  source: string
}

export interface Position {
  offset: number // 從檔案開始
  line: number
  column: number
}
```

這是我們這次將要處理的 AST．\
在 parse 函式中，我們將實現將模板字串轉換為這個 AST．

## 成熟解析器的實現

::: warning
在 2023 年 11 月下旬，在 [vuejs/core#9674](https://github.com/vuejs/core/pull/9674) 中進行了效能改進的重大重寫．  
這些更改在 2023 年 12 月下旬作為 [Vue 3.4](https://blog.vuejs.org/posts/vue-3-4) 發布．  
請注意，這本線上書籍參考的是此重寫之前的實現．  
我們計劃在適當的時機相應地更新這本線上書籍．
:::

在 `~/packages/compiler-core/parse.ts` 中實現它．
即使我說它是成熟的，你也不必太緊張．\
基本上，你所做的就是在讀取字串時生成 AST，並使用分支和迴圈．\
原始碼會有點長，但我認為在程式碼庫中解釋會更容易理解．所以讓我們這樣進行．\
請通過閱讀原始碼來嘗試理解細節．

刪除您迄今為止實現的 baseParse 的內容，並按如下方式更改返回類型：

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

首先，讓我們實現解析期間使用的狀態．
\我們將其命名為 `ParserContext`，並在解析期間在這裡收集必要的資訊．\
最終，我認為它也會保存解析器配置選項等．

```ts
export interface ParserContext {
  // 原始模板字串
  readonly originalSource: string

  source: string

  // 此解析器正在讀取的當前位置
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
  const context = createParserContext(content) // 創建上下文

  // TODO:
  return { children: [] }
}
```

## parseChildren

在順序方面，解析按如下方式進行：(parseChildren) -> (parseElement 或 parseText)．

雖然有點長，但讓我們從 parseChildren 的實現開始．\
解釋將在原始碼的註解中完成．

```ts
export const baseParse = (
  content: string,
): { children: TemplateChildNode[] } => {
  const context = createParserContext(content)
  const children = parseChildren(context, []) // 解析子節點
  return { children: children }
}

function parseChildren(
  context: ParserContext,

  // 由於 HTML 具有遞迴結構，我們將祖先元素保持為堆疊，並在每次嵌套到子元素中時推送它們。
  // 當找到結束標籤時，parseChildren 結束並彈出祖先。
  ancestors: ElementNode[],
): TemplateChildNode[] {
  const nodes: TemplateChildNode[] = []

  while (!isEnd(context, ancestors)) {
    const s = context.source
    let node: TemplateChildNode | undefined = undefined

    if (s[0] === '<') {
      // 如果 s 以 "<" 開頭且下一個字元是字母，則將其解析為元素。
      if (/[a-z]/i.test(s[1])) {
        node = parseElement(context, ancestors) // TODO: 稍後實現這個。
      }
    }

    if (!node) {
      // 如果不匹配上述條件，則將其解析為 TextNode。
      node = parseText(context) // TODO: 稍後實現這個。
    }

    pushNode(nodes, node)
  }

  return nodes
}

// 確定解析子元素的 while 迴圈結束的函式
function isEnd(context: ParserContext, ancestors: ElementNode[]): boolean {
  const s = context.source

  // 如果 s 以 "</" 開頭且祖先的標籤名跟隨，它確定是否有閉合標籤（parseChildren 是否應該結束）。
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
  // 如果 Text 類型的節點是連續的，它們會被合併。
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

接下來，讓我們實現 parseElement 和 parseText．

::: tip 關於 isEnd 迴圈
在 isEnd 中，有一個迴圈過程，使用 startsWithEndTagOpen 檢查 's' 是否以 ancestors 陣列中每個元素的閉合標籤開頭．

```ts
function isEnd(context: ParserContext, ancestors: ElementNode[]): boolean {
  const s = context.source

  // 如果 s 以 </ 開頭且祖先的標籤名跟隨，它確定是否有閉合標籤（parseChildren 是否應該結束）。
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

但是，如果您需要檢查 's' 是否以閉合標籤開頭，只檢查 ancestors 中的最後一個元素應該就足夠了．\
雖然這部分程式碼在解析器的最近重寫中被消除了，但將 Vue 3.3 程式碼修改為只檢查 ancestors 中的最後一個元素仍然會導致所有正面測試成功通過．
:::

## parseText

首先，讓我們從簡單的 parseText 開始．\
它有點長，因為它還實現了一些不僅在 parseText 中使用，而且在其他函式中也使用的實用程式．

```ts
function parseText(context: ParserContext): TextNode {
  // 讀取直到 "<"（無論它是開始還是結束標籤），並根據讀取了多少字元計算 Text 資料結束點的索引。
  const endToken = '<'
  let endIndex = context.source.length
  const index = context.source.indexOf(endToken, 1)
  if (index !== -1 && endIndex > index) {
    endIndex = index
  }

  const start = getCursor(context) // 用於 loc

  // 根據 endIndex 的資訊解析 Text 資料。
  const content = parseTextData(context, endIndex)

  return {
    type: NodeTypes.TEXT,
    content,
    loc: getSelection(context, start),
  }
}

// 根據內容和長度提取文字。
function parseTextData(context: ParserContext, length: number): string {
  const rawText = context.source.slice(0, length)
  advanceBy(context, length)
  return rawText
}

// -------------------- 以下是實用程式（也在 parseElement 等中使用） --------------------

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

// 雖然有點長，但它只是計算位置。
// 它破壞性地更新作為參數接收的 pos 物件。
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

接下來是元素的解析．
元素的解析主要包括解析開始標籤，解析子節點和解析結束標籤．\
開始標籤的解析進一步分為標籤名和屬性．\
讓我們首先創建一個框架來解析開始標籤的前半部分，子節點和結束標籤．

```ts
const enum TagType {
  Start,
  End,
}

function parseElement(
  context: ParserContext,
  ancestors: ElementNode[],
): ElementNode | undefined {
  // 開始標籤。
  const element = parseTag(context, TagType.Start) // TODO:

  // 如果它是像 <img /> 這樣的自閉合元素，我們在這裡結束（因為沒有子元素或結束標籤）。
  if (element.isSelfClosing) {
    return element
  }

  // 子元素。
  ancestors.push(element)
  const children = parseChildren(context, ancestors)
  ancestors.pop()

  element.children = children

  // 結束標籤。
  if (startsWithEndTagOpen(context.source, element.tag)) {
    parseTag(context, TagType.End) // TODO:
  }

  return element
}
```

這裡沒有什麼特別困難的．\
`parseChildren` 函式是遞迴的（因為 `parseElement` 被 `parseChildren` 呼叫）．\
我們在前後操作 `ancestors` 資料結構作為堆疊．

讓我們實現 `parseTag`．

```ts
function parseTag(context: ParserContext, type: TagType): ElementNode {
  // 標籤打開。
  const start = getCursor(context)
  const match = /^<\/?([a-z][^\t\r\n\f />]*)/i.exec(context.source)!
  const tag = match[1]

  advanceBy(context, match[0].length)
  advanceSpaces(context)

  // 屬性。
  let props = parseAttributes(context, type)

  // 標籤關閉。
  let isSelfClosing = false

  // 如果下一個字元是 "/>"，它是一個自閉合標籤。
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

// 解析整個屬性（多個屬性）。
// 例如 `id="app" class="container" style="color: red"`
function parseAttributes(
  context: ParserContext,
  type: TagType,
): AttributeNode[] {
  const props = []
  const attributeNames = new Set<string>()

  // 繼續讀取直到標籤結束。
  while (
    context.source.length > 0 &&
    !startsWith(context.source, '>') &&
    !startsWith(context.source, '/>')
  ) {
    const attr = parseAttribute(context, attributeNames)

    if (type === TagType.Start) {
      props.push(attr)
    }

    advanceSpaces(context) // 跳過空格。
  }

  return props
}

type AttributeValue =
  | {
      content: string
      loc: SourceLocation
    }
  | undefined

// 解析單個屬性。
// 例如 `id="app"`
function parseAttribute(
  context: ParserContext,
  nameSet: Set<string>,
): AttributeNode {
  // 名稱。
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

// 解析屬性的值。
// 此實現允許解析值，無論它們是單引號還是雙引號。
// 它只是提取引號中包含的值。
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

## 完成解析器實現後

我寫了很多程式碼，比平時多．（最多只有大約 300 行）\
我認為在這裡閱讀實現比用特殊詞彙解釋更好，所以請反覆閱讀．\
雖然我寫了很多，但基本上它是通過讀取字串推進分析的直接任務，沒有特別困難的技術．

到現在，您應該能夠生成 AST．讓我們檢查解析是否正常工作．\
但是，由於 codegen 部分尚未實現，我們這次將輸出到控制台進行確認．

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

螢幕不會顯示任何內容，但讓我們檢查控制台．

![simple_template_compiler_complex_html](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/simple_template_compiler_complex_html.png)

看起來解析進展順利．\
現在，讓我們基於生成的 AST 繼續實現 codegen．

## 基於 AST 生成渲染函式

現在我們已經實現了一個成熟的解析器，讓我們創建一個可以應用於它的程式碼生成器．\
但是，在這一點上，不需要複雜的實現．\
我將首先向您展示程式碼．

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

使用上述程式碼，您可以創建有效的東西．\
取消註解解析器章節中被註解掉的部分並檢查實際操作．\
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

![render_template](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/render_template.png)

怎麼樣？看起來我們可以很好地渲染螢幕．

讓我們為螢幕添加一些動作．\
由於我們還沒有實現模板綁定，我們將直接操作 DOM．

```ts
export type ComponentOptions = {
  // .
  // .
  // .
  setup?: (
    props: Record<string, any>,
    ctx: { emit: (event: string, ...args: any[]) => void },
  ) => Function | void // 也允許 void
  // .
  // .
  // .
}
```

```ts
import { createApp } from 'chibivue'

const app = createApp({
  setup() {
    // 使用 Promise.resolve 延遲處理，以便在掛載後可以執行 DOM 操作
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

讓我們確保它正常工作．\
怎麼樣？雖然功能有限，但它越來越接近通常的 Vue 開發者介面．

到此為止的原始碼：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/060_template_compiler2)
