# I want to write more complex HTML

## I want to write more complex HTML

In the current state, I can only express the names and attributes of tags, and the content of text.
Therefore, I want to be able to write more complex HTML in the template.
Specifically, I want to be able to compile a template like this:

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

However, it is difficult to parse such complex HTML with regular expressions. So, from here, I will implement a parser in earnest.

## Introduction of AST

In order to implement a full-fledged compiler, I will introduce something called AST (Abstract Syntax Tree).
AST stands for Abstract Syntax Tree, and as the name suggests, it is a data representation of a tree structure that represents syntax.
This is a concept that appears when implementing various compilers, not just Vue.js.
In many cases (in language processing systems), "parsing" refers to converting it into this representation called AST.
The definition of AST is defined by each language.
For example, JavaScript, which you are familiar with, is represented by AST called [estree](https://github.com/estree/estree), and the source code string is parsed according to this definition.

I tried to explain it in a cool way, but in terms of image, it is just a formal definition of the return type of the parse function that we have implemented so far.
Currently, the return value of the parse function is as follows:

```ts
type ParseResult = {
  tag: string
  props: Record<string, string>
  textContent: string
}
```

Let's extend this and define it so that more complex expressions can be performed.

Create a new file `~/packages/compiler-core/ast.ts`.
I will explain while writing the code because it is a bit long.

```ts
// This represents the type of node.
// It should be noted that the Node here does not refer to the HTML Node, but rather the granularity handled by this template compiler.
// So, not only Element and Text, but also Attribute are treated as one Node.
// This is in line with the design of Vue.js and will be useful when implementing directives in the future.
export const enum NodeTypes {
  ELEMENT,
  TEXT,
  ATTRIBUTE,
}

// All Nodes have type and loc.
// loc stands for location and holds information about where this Node corresponds to in the source code (template string).
// (e.g. which line and where on the line)
export interface Node {
  type: NodeTypes
  loc: SourceLocation
}

// Node for Element.
export interface ElementNode extends Node {
  type: NodeTypes.ELEMENT
  tag: string // e.g. "div"
  props: Array<AttributeNode> // e.g. { name: "class", value: { content: "container" } }
  children: TemplateChildNode[]
  isSelfClosing: boolean // e.g. <img /> -> true
}

// Attribute that ElementNode has.
// It could have been expressed as just Record<string, string>,
// but it is defined to have name(string) and value(TextNode) like Vue.
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

// Information about location.
// Node has this information.
// start and end contain position information.
// source contains the actual code (string).
export interface SourceLocation {
  start: Position
  end: Position
  source: string
}

export interface Position {
  offset: number // from start of file
  line: number
  column: number
}
```

This is the AST we will be dealing with this time.
In the parse function, we will implement the conversion of the template string into this AST.

## Implementation of a full-fledged parser

::: warning
In late November 2023, a major rewrite for performance improvement was conducted in [vuejs/core#9674](https://github.com/vuejs/core/pull/9674).  
These changes were released as [Vue 3.4](https://blog.vuejs.org/posts/vue-3-4) in late December 2023.  
Please note that this online book refers to the implementation prior to this rewrite.  
We plan to update this online book accordingly at the appropriate timing.
:::

Implement it in `~/packages/compiler-core/parse.ts`.
Even if I say it's full-fledged, you don't have to be too nervous. Basically, all you're doing is generating an AST while reading the string and using branching and looping.
The source code will be a bit longer, but I think the explanation will be easier to understand in the code base. So let's proceed that way.
Please try to understand the details by reading the source code.

Delete the contents of baseParse that you have implemented so far, and change the return type as follows:

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

First, let's implement the state used during parsing. We will name it `ParserContext` and gather the necessary information during parsing here. Eventually, I think it will also hold parser configuration options, etc.

```ts
export interface ParserContext {
  // The original template string
  readonly originalSource: string

  source: string

  // The current position that this parser is reading
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
  const context = createParserContext(content) // Create context

  // TODO:
  return { children: [] }
}
```

## parseChildren

In terms of order, the parsing progresses as follows: (parseChildren) -> (parseElement or parseText).

Although it is a bit long, let's start with the implementation of parseChildren. The explanation will be done in the comments in the source code.

```ts
export const baseParse = (
  content: string,
): { children: TemplateChildNode[] } => {
  const context = createParserContext(content)
  const children = parseChildren(context, []) // Parse child nodes
  return { children: children }
}

function parseChildren(
  context: ParserContext,

  // Since HTML has a recursive structure, we keep the ancestor elements as a stack and push them each time we nest in a child.
  // When an end tag is found, parseChildren ends and pops the ancestors.
  ancestors: ElementNode[],
): TemplateChildNode[] {
  const nodes: TemplateChildNode[] = []

  while (!isEnd(context, ancestors)) {
    const s = context.source
    let node: TemplateChildNode | undefined = undefined

    if (s[0] === '<') {
      // If s starts with "<" and the next character is an alphabet, it is parsed as an element.
      if (/[a-z]/i.test(s[1])) {
        node = parseElement(context, ancestors) // TODO: Implement this later.
      }
    }

    if (!node) {
      // If it does not match the above conditions, it is parsed as a TextNode.
      node = parseText(context) // TODO: Implement this later.
    }

    pushNode(nodes, node)
  }

  return nodes
}

// Function to determine the end of the while loop for parsing child elements
function isEnd(context: ParserContext, ancestors: ElementNode[]): boolean {
  const s = context.source

  // If s starts with "</" and the tag name of ancestors follows, it determines whether there is a closing tag (whether parseChildren should end).
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
  // If nodes of type Text are continuous, they are combined.
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

Next, let's implement parseElement and parseText.

::: tip About the isEnd Loop
In isEnd, there is a loop process that checks whether 's' starts with the closing tag of each element in the ancestors array using startsWithEndTagOpen.

```ts
function isEnd(context: ParserContext, ancestors: ElementNode[]): boolean {
  const s = context.source

  // If s starts with </ and the tag name of ancestors follows, it determines whether there is a closing tag (whether parseChildren should end).
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

However, if you need to check whether 's' starts with a closing tag, it should be sufficient to check only the last element in ancestors. Although this section of code was eliminated in a recent rewrite of the parser, modifying the Vue 3.3 code to only check the last element in ancestors still results in all the positive tests passing successfully.
:::

## parseText

First, let's start with the simple parseText. It is a bit long because it also implements some utilities that are used not only in parseText but also in other functions.

```ts
function parseText(context: ParserContext): TextNode {
  // Read until "<" (regardless of whether it is the start or end tag), and calculate the index of the end point of the Text data based on how many characters were read.
  const endToken = '<'
  let endIndex = context.source.length
  const index = context.source.indexOf(endToken, 1)
  if (index !== -1 && endIndex > index) {
    endIndex = index
  }

  const start = getCursor(context) // For loc

  // Parse Text data based on the information of endIndex.
  const content = parseTextData(context, endIndex)

  return {
    type: NodeTypes.TEXT,
    content,
    loc: getSelection(context, start),
  }
}

// Extract text based on content and length.
function parseTextData(context: ParserContext, length: number): string {
  const rawText = context.source.slice(0, length)
  advanceBy(context, length)
  return rawText
}

// -------------------- The following are utilities (also used in parseElement, etc.) --------------------

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

// Although it is a bit long, it simply calculates the position.
// It destructively updates the pos object received as an argument.
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

Next is the parsing of elements.  
The parsing of elements mainly consists of parsing the start tag, parsing child nodes, and parsing the end tag. The parsing of the start tag is further divided into tag name and attributes.  
Let's start by creating a framework for parsing the first half of the start tag, child nodes, and the end tag.

```ts
const enum TagType {
  Start,
  End,
}

function parseElement(
  context: ParserContext,
  ancestors: ElementNode[],
): ElementNode | undefined {
  // Start tag.
  const element = parseTag(context, TagType.Start) // TODO:

  // If it is a self-closing element like <img />, we end here (since there are no children or end tag).
  if (element.isSelfClosing) {
    return element
  }

  // Children.
  ancestors.push(element)
  const children = parseChildren(context, ancestors)
  ancestors.pop()

  element.children = children

  // End tag.
  if (startsWithEndTagOpen(context.source, element.tag)) {
    parseTag(context, TagType.End) // TODO:
  }

  return element
}
```

There is nothing particularly difficult here. The `parseChildren` function is recursive (since `parseElement` is called by `parseChildren`).  
We are manipulating the `ancestors` data structure as a stack before and after.

Let's implement `parseTag`.

```ts
function parseTag(context: ParserContext, type: TagType): ElementNode {
  // Tag open.
  const start = getCursor(context)
  const match = /^<\/?([a-z][^\t\r\n\f />]*)/i.exec(context.source)!
  const tag = match[1]

  advanceBy(context, match[0].length)
  advanceSpaces(context)

  // Attributes.
  let props = parseAttributes(context, type)

  // Tag close.
  let isSelfClosing = false

  // If the next characters are "/>", it is a self-closing tag.
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

// Parsing the entire attributes (multiple attributes).
// eg. `id="app" class="container" style="color: red"`
function parseAttributes(
  context: ParserContext,
  type: TagType,
): AttributeNode[] {
  const props = []
  const attributeNames = new Set<string>()

  // Continue reading until the end of the tag.
  while (
    context.source.length > 0 &&
    !startsWith(context.source, '>') &&
    !startsWith(context.source, '/>')
  ) {
    const attr = parseAttribute(context, attributeNames)

    if (type === TagType.Start) {
      props.push(attr)
    }

    advanceSpaces(context) // Skip spaces.
  }

  return props
}

type AttributeValue =
  | {
      content: string
      loc: SourceLocation
    }
  | undefined

// Parsing a single attribute.
// eg. `id="app"`
function parseAttribute(
  context: ParserContext,
  nameSet: Set<string>,
): AttributeNode {
  // Name.
  const start = getCursor(context)
  const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source)!
  const name = match[0]

  nameSet.add(name)

  advanceBy(context, name.length)

  // Value
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

// Parsing the value of an attribute.
// This implementation allows values to be parsed whether they are single-quoted or double-quoted.
// It simply extracts the value enclosed in quotes.
function parseAttributeValue(context: ParserContext): AttributeValue {
  const start = getCursor(context)
  let content: string

  const quote = context.source[0]
  const isQuoted = quote === `"` || quote === `'`
  if (isQuoted) {
    // Quoted value.
    advanceBy(context, 1)

    const endIndex = context.source.indexOf(quote)
    if (endIndex === -1) {
      content = parseTextData(context, context.source.length)
    } else {
      content = parseTextData(context, endIndex)
      advanceBy(context, 1)
    }
  } else {
    // Unquoted
    const match = /^[^\t\r\n\f >]+/.exec(context.source)
    if (!match) {
      return undefined
    }
    content = parseTextData(context, match[0].length)
  }

  return { content, loc: getSelection(context, start) }
}
```

## After finishing the implementation of the parser

I have written a lot of code, more than usual. (It's only about 300 lines at most)
I think it would be better to read the implementation here rather than explaining it in special words, so please read it repeatedly.
Although I have written a lot, basically it is a straightforward task of advancing the analysis by reading the string, and there are no particularly difficult techniques.

By now, you should be able to generate an AST. Let's check if the parsing is working.
However, since the codegen part has not been implemented yet, we will output it to the console for confirmation this time.

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
  const parseResult = baseParse(template.trim()) // Trim the template
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

The screen will not display anything, but let's check the console.

![simple_template_compiler_complex_html](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/simple_template_compiler_complex_html.png)

It seems that the parsing is going well.
Now, let's proceed with the implementation of the codegen based on the generated AST.

## Generating the render function based on the AST

Now that we have implemented a full-fledged parser, let's create a code generator that can be applied to it.
However, at this point, there is no need for a complex implementation.
I will show you the code first.

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

With the above code, you can create something that works.
Uncomment the part that was commented out in the parser chapter and check the actual operation.
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

How about that? It seems that we can render the screen very nicely.

Let's add some movement to the screen. Since we haven't implemented template binding, we will directly manipulate the DOM.

```ts
export type ComponentOptions = {
  // .
  // .
  // .
  setup?: (
    props: Record<string, any>,
    ctx: { emit: (event: string, ...args: any[]) => void },
  ) => Function | void // Allow void as well
  // .
  // .
  // .
}
```

```ts
import { createApp } from 'chibivue'

const app = createApp({
  setup() {
    // Delay the processing with Promise.resolve so that DOM operations can be performed after mounting
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

Let's make sure it is working correctly.
How about that? Although the functionality is limited, it is getting closer to the usual Vue developer interface.

Source code up to this point:  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/060_template_compiler2)