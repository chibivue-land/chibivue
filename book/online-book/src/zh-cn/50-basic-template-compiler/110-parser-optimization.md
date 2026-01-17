# 解析器优化

::: info 关于本章
本章介绍 Vue 3.4 中引入的新解析器架构。\
基于 htmlparser2 的状态机 tokenizer 使解析速度提高了 2 倍。
:::

## 背景

在 Vue 3.4 中，模板编译器的内部实现进行了重大重构。到目前为止，我们在 chibivue 中实现的解析器是基于 Vue 3.3 及更早版本的架构。

### 传统解析器（Vue 3.3 及更早版本）

传统的 Vue 解析器是**递归下降解析器（recursive descent parser）**：

```ts
// 传统实现
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

这种方式的问题：
- 大量使用**正则表达式**
- 频繁的**前瞻（look-ahead）搜索**
- 多次遍历模板字符串

### 新解析器（Vue 3.4）

Vue 3.4 引入了基于 [htmlparser2](https://github.com/fb55/htmlparser2) 的**状态机 tokenizer**：

```ts
// 新实现
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

这种方式的优点：
- **单次遍历**模板字符串
- 不使用正则表达式（或最小化使用）
- **逐字符**处理效率高
- 清晰的**状态转换**提高可维护性

<KawaikoNote variant="surprise" title="速度提升 2 倍！">

这个状态机 tokenizer 实现了**一致的 2 倍**解析速度提升！\
令人惊讶的是，仅仅通过避免正则表达式和前瞻搜索，一个字符一个字符地顺序处理，就能实现如此显著的性能提升。

</KawaikoNote>

## 状态机 Tokenizer

状态机 tokenizer 根据当前状态决定如何处理下一个字符。

### 状态定义

```ts
const enum State {
  // 文本
  Text = 1,

  // 插值（Mustache）
  InterpolationOpen,     // 检测 {{
  Interpolation,         // {{ 内的内容
  InterpolationClose,    // 检测 }}

  // 标签
  BeforeTagName,         // < 之后
  InTagName,             // 标签名内部
  InSelfClosingTag,      // 检测 />

  // 属性
  BeforeAttrName,        // 属性名之前
  InAttrName,            // 属性名内部
  AfterAttrName,         // 属性名之后（= 之前）
  BeforeAttrValue,       // 属性值之前
  InAttrValueDq,         // 双引号内的属性值
  InAttrValueSq,         // 单引号内的属性值
  InAttrValueNq,         // 无引号的属性值

  // 指令
  InDirName,             // 指令名（v-xxx）
  InDirArg,              // 指令参数（:xxx）
  InDirDynamicArg,       // 动态参数（[xxx]）
  InDirModifier,         // 修饰符（.xxx）
}
```

### 状态转换示例

```
<div v-if="show">Hello {{ name }}</div>
```

此示例的状态转换：

```
< → BeforeTagName
d → InTagName
i → InTagName
v → InTagName
(空格) → BeforeAttrName
v → InAttrName (或 InDirName)
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
(空格) → Interpolation
n → Interpolation
a → Interpolation
m → Interpolation
e → Interpolation
(空格) → Interpolation
} → InterpolationClose
} → Text
...
```

## Visitor 模式

新解析器使用 **Visitor 模式**将 tokenizer 与 AST 构建分离。

### Callbacks 接口

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

### Tokenizer 与 Parser 的分离

```ts
class Tokenizer {
  private cbs: Callbacks

  constructor(callbacks: Callbacks) {
    this.cbs = callbacks
  }

  // Tokenizer 发出事件
  private emitOpenTag(tag: string, start: number) {
    this.cbs.onOpenTag(tag, start)
  }

  private emitText(start: number, end: number) {
    this.cbs.onText(start, end)
  }
}

// Parser 实现 Callbacks 来构建 AST
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

### 优点

1. **关注点分离**：Tokenizer 只专注于字符解析，Parser 只专注于 AST 构建
2. **可测试性**：每个组件可以独立测试
3. **可复用性**：Tokenizer 可以重用于其他目的（语法高亮、Lint 等）
4. **性能**：不生成不必要的中间数据结构

<KawaikoNote variant="question" title="什么是 Visitor 模式？">

Visitor 模式是一种"将数据结构与其处理分离"的设计模式。\
Tokenizer "只读取模板并发出事件"，Parser "只接收事件并构建 AST"——简单的职责划分。\
这使得代码更容易理解和测试！

</KawaikoNote>

## 性能比较

根据 Vue 3.4 博客文章：

| 模板大小 | 改进率 |
|---------|-------|
| 小型 | ~2x |
| 中型 | ~2x |
| 大型 | ~2x |

实现了一致的 2 倍加速。

此改进惠及整个生态系统：
- **Volar**：IDE 补全和类型检查
- **vue-tsc**：类型检查
- **构建工具**：Vite、Webpack 等
- **社区插件**：ESLint、Prettier 等

## chibivue 中的实现

::: warning
当前 chibivue 使用传统的递归下降解析器。\
迁移到 Vue 3.4 风格的 tokenizer 正在考虑作为未来的工作。
:::

基本实现概要：

<KawaikoNote variant="base" title="有兴趣就来挑战！">

本章介绍的状态机 tokenizer 在 chibivue 中还没有实现，但如果你有兴趣，可以尝试自己实现！\
参考 Vue 3.4 的源代码和 htmlparser2 会加深你的理解。\
解析器优化是框架开发中非常重要的技能。

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

## 总结

- Vue 3.4 引入了基于 htmlparser2 的状态机 tokenizer
- 通过只扫描模板字符串一次，解析速度提高了 2 倍
- Visitor 模式分离了 tokenizer 和 AST 构建，提高了可维护性
- 此优化惠及整个生态系统（Volar、vue-tsc 等）

## 参考链接

- [Announcing Vue 3.4](https://blog.vuejs.org/posts/vue-3-4) - Vue 官方博客
- [htmlparser2](https://github.com/fb55/htmlparser2) - Tokenizer 基于的库
- [Vue 3.4 Parser Refactor](https://github.com/vuejs/core/pull/9674) - GitHub PR
