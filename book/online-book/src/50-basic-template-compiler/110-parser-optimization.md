# Parser Optimization

::: info About this chapter
This chapter explains the new parser architecture introduced in Vue 3.4.\
With a state-machine tokenizer based on htmlparser2, parse speed has improved by 2x.
:::

## Background

In Vue 3.4, the internal implementation of the template compiler was significantly refactored. The parser we have implemented in chibivue so far is based on the architecture from Vue 3.3 and earlier.

### Traditional Parser (Vue 3.3 and earlier)

The traditional Vue parser was a **recursive descent parser**:

```ts
// Traditional implementation
function parseChildren(context: ParserContext): TemplateChildNode[] {
  const nodes: TemplateChildNode[] = []

  while (!isEnd(context)) {
    const s = context.source
    let node: TemplateChildNode | undefined

    if (startsWith(s, '{{')) {
      node = parseInterpolation(context)
    } else if (s[0] === '<') {
      if (/[a-z]/i.test(s[1])) {
        node = parseElement(context)
      }
    }

    if (!node) {
      node = parseText(context)
    }

    nodes.push(node)
  }

  return nodes
}
```

Problems with this approach:
- Heavy use of **regular expressions**
- Frequent **look-ahead searches**
- Multiple passes through the template string

### New Parser (Vue 3.4)

Vue 3.4 introduced a **state-machine tokenizer** based on [htmlparser2](https://github.com/fb55/htmlparser2):

```ts
// New implementation
const enum State {
  Text,
  InterpolationOpen,
  Interpolation,
  InterpolationClose,
  BeforeTagName,
  InTagName,
  BeforeAttrName,
  InAttrName,
  // ...
}

class Tokenizer {
  private state = State.Text
  private index = 0

  parse(input: string) {
    for (let i = 0; i < input.length; i++) {
      this.index = i
      this.consume(input.charCodeAt(i))
    }
  }

  private consume(char: number) {
    switch (this.state) {
      case State.Text:
        this.handleText(char)
        break
      case State.BeforeTagName:
        this.handleBeforeTagName(char)
        break
      // ...
    }
  }
}
```

Benefits of this approach:
- **Single pass** through the template string
- No regular expressions (or minimal use)
- **Character-by-character** processing is efficient
- Clear **state transitions** improve maintainability

<KawaikoNote variant="surprise" title="2x Faster!">

This state-machine tokenizer achieves a **consistent 2x speedup** in parse time!\
It's amazing that such significant performance improvements can be achieved simply by avoiding regular expressions and look-ahead searches, processing one character at a time.

</KawaikoNote>

## State Machine Tokenizer

The state machine tokenizer determines how to process the next character based on the current state.

### State Definitions

```ts
const enum State {
  // Text
  Text = 1,

  // Interpolation (Mustache)
  InterpolationOpen,     // Detecting {{
  Interpolation,         // Content inside {{
  InterpolationClose,    // Detecting }}

  // Tags
  BeforeTagName,         // After <
  InTagName,             // Inside tag name
  InSelfClosingTag,      // Detecting />

  // Attributes
  BeforeAttrName,        // Before attribute name
  InAttrName,            // Inside attribute name
  AfterAttrName,         // After attribute name (before =)
  BeforeAttrValue,       // Before attribute value
  InAttrValueDq,         // Attribute value in double quotes
  InAttrValueSq,         // Attribute value in single quotes
  InAttrValueNq,         // Unquoted attribute value

  // Directives
  InDirName,             // Directive name (v-xxx)
  InDirArg,              // Directive argument (:xxx)
  InDirDynamicArg,       // Dynamic argument ([xxx])
  InDirModifier,         // Modifier (.xxx)
}
```

### State Transition Example

```
<div v-if="show">Hello {{ name }}</div>
```

State transitions for this example:

```
< → BeforeTagName
d → InTagName
i → InTagName
v → InTagName
(space) → BeforeAttrName
v → InAttrName (or InDirName)
- → InDirName
i → InDirName
f → InDirName
= → BeforeAttrValue
" → InAttrValueDq
s → InAttrValueDq
h → InAttrValueDq
o → InAttrValueDq
w → InAttrValueDq
" → BeforeAttrName
> → Text
H → Text
...
{ → InterpolationOpen
{ → Interpolation
(space) → Interpolation
n → Interpolation
a → Interpolation
m → Interpolation
e → Interpolation
(space) → Interpolation
} → InterpolationClose
} → Text
...
```

## Visitor Pattern

The new parser uses the **Visitor pattern** to separate the tokenizer from AST construction.

### Callbacks Interface

```ts
interface Callbacks {
  onText(start: number, end: number): void
  onInterpolation(start: number, end: number): void
  onOpenTag(tag: string, start: number): void
  onCloseTag(tag: string, start: number, end: number): void
  onSelfClosingTag(tag: string, start: number, end: number): void
  onAttr(name: string, value: string | undefined, start: number, end: number): void
  onDirective(
    name: string,
    arg: string | undefined,
    modifiers: string[],
    value: string | undefined,
    start: number,
    end: number
  ): void
  onComment(start: number, end: number): void
}
```

### Separation of Tokenizer and Parser

```ts
class Tokenizer {
  private cbs: Callbacks

  constructor(callbacks: Callbacks) {
    this.cbs = callbacks
  }

  // Tokenizer emits events
  private emitOpenTag(tag: string, start: number) {
    this.cbs.onOpenTag(tag, start)
  }

  private emitText(start: number, end: number) {
    this.cbs.onText(start, end)
  }
}

// Parser implements Callbacks to build AST
class Parser implements Callbacks {
  private stack: ElementNode[] = []
  private root: RootNode

  onOpenTag(tag: string, start: number) {
    const element: ElementNode = {
      type: NodeTypes.ELEMENT,
      tag,
      children: [],
      // ...
    }
    this.stack.push(element)
  }

  onCloseTag(tag: string, start: number, end: number) {
    const element = this.stack.pop()!
    const parent = this.stack[this.stack.length - 1]
    if (parent) {
      parent.children.push(element)
    } else {
      this.root.children.push(element)
    }
  }

  onText(start: number, end: number) {
    const parent = this.stack[this.stack.length - 1]
    const text: TextNode = {
      type: NodeTypes.TEXT,
      content: this.source.slice(start, end),
      // ...
    }
    parent.children.push(text)
  }
}
```

### Benefits

1. **Separation of concerns**: Tokenizer focuses only on character parsing, Parser focuses only on AST construction
2. **Testability**: Each component can be tested independently
3. **Reusability**: Tokenizer can be reused for other purposes (syntax highlighting, linting, etc.)
4. **Performance**: No unnecessary intermediate data structures

<KawaikoNote variant="question" title="What is the Visitor Pattern?">

The Visitor pattern is a design pattern that "separates data structure from its processing".\
The Tokenizer "just reads the template and emits events", while the Parser "just receives events and builds the AST" - a simple division of responsibilities.\
This makes the code easier to understand and test!

</KawaikoNote>

## Performance Comparison

According to the Vue 3.4 blog post:

| Template Size | Improvement |
|--------------|-------------|
| Small | ~2x |
| Medium | ~2x |
| Large | ~2x |

A consistent 2x speedup has been achieved.

This improvement benefits the entire ecosystem:
- **Volar**: IDE completion and type checking
- **vue-tsc**: Type checking
- **Build tools**: Vite, Webpack, etc.
- **Community plugins**: ESLint, Prettier, etc.

## Implementation in chibivue

::: warning
Current chibivue uses the traditional recursive descent parser.\
Migration to a Vue 3.4-style tokenizer is being considered for future work.
:::

Basic implementation outline:

<KawaikoNote variant="base" title="Challenge Yourself!">

The state-machine tokenizer introduced in this chapter is not yet implemented in chibivue, but if you're interested, try implementing it yourself!\
Referring to Vue 3.4's source code and htmlparser2 will deepen your understanding.\
Parser optimization is a very important skill in framework development.

</KawaikoNote>

```ts
// packages/compiler-core/tokenizer.ts
const enum State {
  Text = 1,
  InterpolationOpen,
  Interpolation,
  InterpolationClose,
  BeforeTagName,
  InTagName,
  // ...
}

const enum CharCodes {
  Lt = 0x3c,      // <
  Gt = 0x3e,      // >
  Slash = 0x2f,   // /
  Eq = 0x3d,      // =
  OpenBrace = 0x7b,  // {
  CloseBrace = 0x7d, // }
  // ...
}

export class Tokenizer {
  private state = State.Text
  private buffer = ''
  private sectionStart = 0
  private index = 0

  constructor(private cbs: Callbacks) {}

  parse(input: string) {
    this.buffer = input
    while (this.index < input.length) {
      const c = input.charCodeAt(this.index)
      switch (this.state) {
        case State.Text:
          this.stateText(c)
          break
        case State.InterpolationOpen:
          this.stateInterpolationOpen(c)
          break
        // ...
      }
      this.index++
    }
    this.finish()
  }

  private stateText(c: number) {
    if (c === CharCodes.Lt) {
      if (this.index > this.sectionStart) {
        this.cbs.onText(this.sectionStart, this.index)
      }
      this.state = State.BeforeTagName
      this.sectionStart = this.index
    } else if (c === CharCodes.OpenBrace) {
      this.state = State.InterpolationOpen
    }
  }

  private stateInterpolationOpen(c: number) {
    if (c === CharCodes.OpenBrace) {
      if (this.index > this.sectionStart + 1) {
        this.cbs.onText(this.sectionStart, this.index - 1)
      }
      this.state = State.Interpolation
      this.sectionStart = this.index + 1
    } else {
      this.state = State.Text
    }
  }

  // ...
}
```

## Summary

- Vue 3.4 introduced a state-machine tokenizer based on htmlparser2
- Parse speed improved by 2x by scanning the template string only once
- Visitor pattern separates tokenizer and AST construction for better maintainability
- This optimization benefits the entire ecosystem (Volar, vue-tsc, etc.)

## References

- [Announcing Vue 3.4](https://blog.vuejs.org/posts/vue-3-4) - Vue Official Blog
- [htmlparser2](https://github.com/fb55/htmlparser2) - The library the tokenizer is based on
- [Vue 3.4 Parser Refactor](https://github.com/vuejs/core/pull/9674) - GitHub PR
