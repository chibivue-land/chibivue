# 解析器優化

::: info 關於本章
本章介紹 Vue 3.4 中引入的新解析器架構．\
基於 htmlparser2 的狀態機 tokenizer 使解析速度提高了 2 倍．
:::

## 背景

在 Vue 3.4 中，模板編譯器的內部實現進行了重大重構．到目前為止，我們在 chibivue 中實現的解析器是基於 Vue 3.3 及更早版本的架構．

### 傳統解析器（Vue 3.3 及更早版本）

傳統的 Vue 解析器是**遞迴下降解析器（recursive descent parser）**：

```ts
// 傳統實現
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

這種方式的問題：
- 大量使用**正規表示式**
- 頻繁的**前瞻（look-ahead）搜尋**
- 多次遍歷模板字串

### 新解析器（Vue 3.4）

Vue 3.4 引入了基於 [htmlparser2](https://github.com/fb55/htmlparser2) 的**狀態機 tokenizer**：

```ts
// 新實現
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

這種方式的優點：
- **單次遍歷**模板字串
- 不使用正規表示式（或最小化使用）
- **逐字元**處理效率高
- 清晰的**狀態轉換**提高可維護性

<KawaikoNote variant="surprise" title="速度提升 2 倍！">

這個狀態機 tokenizer 實現了**一致的 2 倍**解析速度提升！\
令人驚訝的是，僅僅通過避免正規表示式和前瞻搜尋，一個字元一個字元地順序處理，就能實現如此顯著的效能提升．

</KawaikoNote>

## 狀態機 Tokenizer

狀態機 tokenizer 根據當前狀態決定如何處理下一個字元．

### 狀態定義

```ts
const enum State {
  // 文字
  Text = 1,

  // 插值（Mustache）
  InterpolationOpen,     // 檢測 {{
  Interpolation,         // {{ 內的內容
  InterpolationClose,    // 檢測 }}

  // 標籤
  BeforeTagName,         // < 之後
  InTagName,             // 標籤名內部
  InSelfClosingTag,      // 檢測 />

  // 屬性
  BeforeAttrName,        // 屬性名之前
  InAttrName,            // 屬性名內部
  AfterAttrName,         // 屬性名之後（= 之前）
  BeforeAttrValue,       // 屬性值之前
  InAttrValueDq,         // 雙引號內的屬性值
  InAttrValueSq,         // 單引號內的屬性值
  InAttrValueNq,         // 無引號的屬性值

  // 指令
  InDirName,             // 指令名（v-xxx）
  InDirArg,              // 指令參數（:xxx）
  InDirDynamicArg,       // 動態參數（[xxx]）
  InDirModifier,         // 修飾符（.xxx）
}
```

### 狀態轉換範例

```
<div v-if="show">Hello {{ name }}</div>
```

此範例的狀態轉換：

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

新解析器使用 **Visitor 模式**將 tokenizer 與 AST 建構分離．

### Callbacks 介面

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

### Tokenizer 與 Parser 的分離

```ts
class Tokenizer {
  private cbs: Callbacks

  constructor(callbacks: Callbacks) {
    this.cbs = callbacks
  }

  // Tokenizer 發出事件
  private emitOpenTag(tag: string, start: number) {
    this.cbs.onOpenTag(tag, start)
  }

  private emitText(start: number, end: number) {
    this.cbs.onText(start, end)
  }
}

// Parser 實現 Callbacks 來建構 AST
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

### 優點

1. **關注點分離**：Tokenizer 只專注於字元解析，Parser 只專注於 AST 建構
2. **可測試性**：每個元件可以獨立測試
3. **可複用性**：Tokenizer 可以重用於其他目的（語法高亮，Lint 等）
4. **效能**：不生成不必要的中間資料結構

<KawaikoNote variant="question" title="什麼是 Visitor 模式？">

Visitor 模式是一種「將資料結構與其處理分離」的設計模式．\
Tokenizer「只讀取模板並發出事件」，Parser「只接收事件並建構 AST」——簡單的職責劃分．\
這使得程式碼更容易理解和測試！

</KawaikoNote>

## 效能比較

根據 Vue 3.4 部落格文章：

| 模板大小 | 改進率 |
|---------|-------|
| 小型 | ~2x |
| 中型 | ~2x |
| 大型 | ~2x |

實現了一致的 2 倍加速．

此改進惠及整個生態系統：
- **Volar**：IDE 補全和型別檢查
- **vue-tsc**：型別檢查
- **建構工具**：Vite，Webpack 等
- **社群外掛**：ESLint，Prettier 等

## chibivue 中的實現

::: warning
當前 chibivue 使用傳統的遞迴下降解析器．\
遷移到 Vue 3.4 風格的 tokenizer 正在考慮作為未來的工作．
:::

基本實現概要：

<KawaikoNote variant="base" title="有興趣就來挑戰！">

本章介紹的狀態機 tokenizer 在 chibivue 中還沒有實現，但如果你有興趣，可以嘗試自己實現！\
參考 Vue 3.4 的原始碼和 htmlparser2 會加深你的理解．\
解析器優化是框架開發中非常重要的技能．

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

## 總結

- Vue 3.4 引入了基於 htmlparser2 的狀態機 tokenizer
- 透過只掃描模板字串一次，解析速度提高了 2 倍
- Visitor 模式分離了 tokenizer 和 AST 建構，提高了可維護性
- 此優化惠及整個生態系統（Volar，vue-tsc 等）

## 參考連結

- [Announcing Vue 3.4](https://blog.vuejs.org/posts/vue-3-4) - Vue 官方部落格
- [htmlparser2](https://github.com/fb55/htmlparser2) - Tokenizer 基於的函式庫
- [Vue 3.4 Parser Refactor](https://github.com/vuejs/core/pull/9674) - GitHub PR
