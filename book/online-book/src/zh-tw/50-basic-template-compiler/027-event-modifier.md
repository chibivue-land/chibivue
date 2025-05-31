# 事件修飾符

## 這次要做的事情

由於我們上次實現了 v-on 指令，現在讓我們實現事件修飾符。

Vue.js 有對應於 preventDefault 和 stopPropagation 的修飾符。

https://vuejs.org/guide/essentials/event-handling.html

這次，讓我們以以下開發者介面為目標。

```ts
import { createApp, defineComponent, ref } from 'chibivue'

const App = defineComponent({
  setup() {
    const inputText = ref('')

    const buffer = ref('')
    const handleInput = (e: Event) => {
      const target = e.target as HTMLInputElement
      buffer.value = target.value
    }
    const submit = () => {
      inputText.value = buffer.value
      buffer.value = ''
    }

    return { inputText, buffer, handleInput, submit }
  },

  template: `<div>
    <form @submit.prevent="submit">
      <label>
        Input Data
        <input :value="buffer" @input="handleInput" />
      </label>
      <button>submit</button>
    </form>
    <p>inputText: {{ inputText }}</p>
</div>`,
})

const app = createApp(App)

app.mount('#app')
```

特別是，請注意以下部分。

```html
<form @submit.prevent="submit"></form>
```

有一個 `@submit.prevent` 的描述。這意味著在呼叫 submit 事件處理器時，執行 `preventDefault`。

如果不包含 `.prevent`，提交時頁面將重新載入。

## AST 和解析器的實現

由於我們要向模板添加新語法，需要對解析器和 AST 進行更改。

首先，讓我們看看 AST。這很簡單，只需向 `DirectiveNode` 添加一個名為 `modifiers`（字串陣列）的屬性。

```ts
export interface DirectiveNode extends Node {
  type: NodeTypes.DIRECTIVE
  name: string
  exp: ExpressionNode | undefined
  arg: ExpressionNode | undefined
  modifiers: string[] // 添加這個
}
```

讓我們相應地實現解析器。

實際上，這很容易，因為它已經包含在從原始原始碼借用的正規表達式中。

```ts
function parseAttribute(
  context: ParserContext,
  nameSet: Set<string>,
): AttributeNode | DirectiveNode {
  // .
  // .
  // .
  const modifiers = match[3] ? match[3].slice(1).split('.') : [] // 從匹配結果中提取修飾符
  return {
    type: NodeTypes.DIRECTIVE,
    name: dirName,
    exp: value && {
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: value.content,
      isStatic: false,
      loc: value.loc,
    },
    loc,
    arg,
    modifiers, // 包含在返回中
  }
}
```

是的。透過這樣，AST 和解析器的實現就完成了。

## compiler-dom/transform

讓我們稍微回顧一下當前的編譯器架構。

當前的配置如下。

![50-027-compiler-architecture](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/50-027-compiler-architecture.drawio.png)

當你再次理解 compiler-core 和 compiler-dom 的角色時，  
compiler-core 提供不依賴於 DOM 的編譯器功能，如生成和轉換 AST。

到目前為止，我們在 compiler-core 中實現了 v-on 指令，但這只是將符號 `@click="handle"` 轉換為物件 `{ onClick: handle }`，  
它不執行任何依賴於 DOM 的處理。

現在，讓我們看看這次我們想要實現的內容。  
這次，我們想要生成實際執行 `e.preventDefault()` 或 `e.stopPropagation()` 的程式碼。  
這些嚴重依賴於 DOM。

因此，我們也將在 compiler-dom 端實現轉換器。我們將在這裡實現與 DOM 相關的轉換器。

在 compiler-core 中，我們需要考慮 compiler-core 中的 transform 和在 compiler-dom 中實現的 transform 之間的交互。  
交互是如何在執行 compiler-core 中的 transform 的同時實現在 compiler-dom 中實現的 transform。

所以首先，讓我們修改在 compiler-core 中實現的 `DirectiveTransform` 介面。

```ts
export type DirectiveTransform = (
  dir: DirectiveNode,
  node: ElementNode,
  context: TransformContext,
  augmentor?: (ret: DirectiveTransformResult) => DirectiveTransformResult, // 添加
) => DirectiveTransformResult
```

我添加了 `augmentor`。  
嗯，這只是一個回呼函式。透過允許接收回呼作為 `DirectiveTransform` 介面的一部分，我們使轉換函式可擴展。

在 compiler-dom 中，我們將實現一個包裝在 compiler-core 中實現的轉換器的轉換器。

```ts
// 實現示例

// compiler-dom 端的實現

import { transformOn as baseTransformOn } from 'compiler-core'

export const transformOn: DirectiveTransform = (dir, node, context) => {
  return baseTransformOn(dir, node, context, () => {
    /** 在這裡實現 compiler-dom 自己的實現 */
    return {
      /** */
    }
  })
}
```

如果你將在 compiler-dom 端實現的這個 `transformOn` 作為選項傳遞給編譯器，就可以了。  
這是關係的圖表。  
不是從 compiler-dom 傳遞所有轉換器，而是在 compiler-core 中實現預設實現，配置允許添加額外的轉換器。

![50-027-new-compiler-architecture](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/50-027-new-compiler-architecture.drawio.png)

透過這樣，compiler-core 可以執行不依賴於 DOM 的轉換器，compiler-dom 可以在執行 compiler-core 中的轉換器的同時實現依賴於 DOM 的處理。

## 轉換器的實現

現在，讓我們在 compiler-dom 端實現轉換器。

我們應該如何轉換它？現在，由於即使我們簡單地說"修飾符"也有各種類型的修飾符，讓我們對它們進行分類，以便我們可以考慮未來的可能性。

這次，我們將實現"事件修飾符"。讓我們首先將其提取為 `eventModifiers`。

```ts
const isEventModifier = makeMap(
  // 事件傳播管理
  `stop,prevent,self`,
)

const resolveModifiers = (modifiers: string[]) => {
  const eventModifiers = []

  for (let i = 0; i < modifiers.length; i++) {
    const modifier = modifiers[i]
    if (isEventModifier(modifier)) {
      eventModifiers.push(modifier)
    }
  }

  return { eventModifiers }
}
```

現在我們已經提取了 `eventModifiers`，我們應該如何使用它？總之，我們將在 runtime-dom 端實現一個名為 `withModifiers` 的輔助函式，並將其轉換為呼叫該函式的表達式。

```ts
// runtime-dom/runtimeHelpers.ts

export const V_ON_WITH_MODIFIERS = Symbol()
```

```ts
export const transformOn: DirectiveTransform = (dir, node, context) => {
  return baseTransform(dir, node, context, baseResult => {
    const { modifiers } = dir
    if (!modifiers.length) return baseResult

    let { key, value: handlerExp } = baseResult.props[0]
    const { eventModifiers } = resolveModifiers(modifiers)

    if (eventModifiers.length) {
      handlerExp = createCallExpression(context.helper(V_ON_WITH_MODIFIERS), [
        handlerExp,
        JSON.stringify(eventModifiers),
      ])
    }

    return {
      props: [createObjectProperty(key, handlerExp)],
    }
  })
}
```

透過這樣，轉換器的實現幾乎完成了。

現在讓我們在 compiler-dom 端實現 `withModifiers`。

## `withModifiers` 的實現

讓我們在 runtime-dom/directives/vOn.ts 中繼續實現。

實現非常簡單。

為事件修飾符實現一個保護函式，並實現它，使其執行與陣列中接收的修飾符數量一樣多的次數。

```ts
const modifierGuards: Record<string, (e: Event) => void | boolean> = {
  stop: e => e.stopPropagation(),
  prevent: e => e.preventDefault(),
  self: e => e.target !== e.currentTarget,
}

export const withModifiers = (fn: Function, modifiers: string[]) => {
  return (event: Event, ...args: unknown[]) => {
    for (let i = 0; i < modifiers.length; i++) {
      const guard = modifierGuards[modifiers[i]]
      if (guard && guard(event)) return
    }
    return fn(event, ...args)
  }
}
```

這就是實現的結束。

讓我們檢查操作！如果按下按鈕時輸入內容反映在螢幕上而頁面沒有重新載入，就可以了！

到此為止的原始碼：[GitHub](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/027_event_modifier)

## 其他修飾符

現在我們已經走到這一步，讓我們實現其他修飾符。

基本的實現方法是相同的。

讓我們按如下方式對修飾符進行分類：

```ts
const keyModifiers = []
const nonKeyModifiers = []
const eventOptionModifiers = []
```

然後，生成必要的映射並用 `resolveModifiers` 對它們進行分類。

需要注意的兩點是：

- 修飾符名稱和實際 DOM API 名稱之間的差異
- 實現一個新的輔助函式來執行特定的鍵事件（withKeys）

請在閱讀實際程式碼的同時嘗試實現！
如果你已經走到這一步，你應該能夠做到。

到此為止的原始碼：[GitHub](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/027_event_modifier2)
