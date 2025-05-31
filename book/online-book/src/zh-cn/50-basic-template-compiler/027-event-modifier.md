# 事件修饰符

## 这次要做的事情

由于我们上次实现了 v-on 指令，现在让我们实现事件修饰符。

Vue.js 有对应于 preventDefault 和 stopPropagation 的修饰符。

https://vuejs.org/guide/essentials/event-handling.html

这次，让我们以以下开发者接口为目标。

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

特别是，请注意以下部分。

```html
<form @submit.prevent="submit"></form>
```

有一个 `@submit.prevent` 的描述。这意味着在调用 submit 事件处理器时，执行 `preventDefault`。

如果不包含 `.prevent`，提交时页面将重新加载。

## AST 和解析器的实现

由于我们要向模板添加新语法，需要对解析器和 AST 进行更改。

首先，让我们看看 AST。这很简单，只需向 `DirectiveNode` 添加一个名为 `modifiers`（字符串数组）的属性。

```ts
export interface DirectiveNode extends Node {
  type: NodeTypes.DIRECTIVE
  name: string
  exp: ExpressionNode | undefined
  arg: ExpressionNode | undefined
  modifiers: string[] // 添加这个
}
```

让我们相应地实现解析器。

实际上，这很容易，因为它已经包含在从原始源代码借用的正则表达式中。

```ts
function parseAttribute(
  context: ParserContext,
  nameSet: Set<string>,
): AttributeNode | DirectiveNode {
  // .
  // .
  // .
  const modifiers = match[3] ? match[3].slice(1).split('.') : [] // 从匹配结果中提取修饰符
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

是的。通过这样，AST 和解析器的实现就完成了。

## compiler-dom/transform

让我们稍微回顾一下当前的编译器架构。

当前的配置如下。

![50-027-compiler-architecture](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/50-027-compiler-architecture.drawio.png)

当你再次理解 compiler-core 和 compiler-dom 的角色时，  
compiler-core 提供不依赖于 DOM 的编译器功能，如生成和转换 AST。

到目前为止，我们在 compiler-core 中实现了 v-on 指令，但这只是将符号 `@click="handle"` 转换为对象 `{ onClick: handle }`，  
它不执行任何依赖于 DOM 的处理。

现在，让我们看看这次我们想要实现的内容。  
这次，我们想要生成实际执行 `e.preventDefault()` 或 `e.stopPropagation()` 的代码。  
这些严重依赖于 DOM。

因此，我们也将在 compiler-dom 端实现转换器。我们将在这里实现与 DOM 相关的转换器。

在 compiler-core 中，我们需要考虑 compiler-core 中的 transform 和在 compiler-dom 中实现的 transform 之间的交互。  
交互是如何在执行 compiler-core 中的 transform 的同时实现在 compiler-dom 中实现的 transform。

所以首先，让我们修改在 compiler-core 中实现的 `DirectiveTransform` 接口。

```ts
export type DirectiveTransform = (
  dir: DirectiveNode,
  node: ElementNode,
  context: TransformContext,
  augmentor?: (ret: DirectiveTransformResult) => DirectiveTransformResult, // 添加
) => DirectiveTransformResult
```

我添加了 `augmentor`。  
嗯，这只是一个回调函数。通过允许接收回调作为 `DirectiveTransform` 接口的一部分，我们使转换函数可扩展。

在 compiler-dom 中，我们将实现一个包装在 compiler-core 中实现的转换器的转换器。

```ts
// 实现示例

// compiler-dom 端的实现

import { transformOn as baseTransformOn } from 'compiler-core'

export const transformOn: DirectiveTransform = (dir, node, context) => {
  return baseTransformOn(dir, node, context, () => {
    /** 在这里实现 compiler-dom 自己的实现 */
    return {
      /** */
    }
  })
}
```

如果你将在 compiler-dom 端实现的这个 `transformOn` 作为选项传递给编译器，就可以了。  
这是关系的图表。  
不是从 compiler-dom 传递所有转换器，而是在 compiler-core 中实现默认实现，配置允许添加额外的转换器。

![50-027-new-compiler-architecture](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/50-027-new-compiler-architecture.drawio.png)

通过这样，compiler-core 可以执行不依赖于 DOM 的转换器，compiler-dom 可以在执行 compiler-core 中的转换器的同时实现依赖于 DOM 的处理。

## 转换器的实现

现在，让我们在 compiler-dom 端实现转换器。

我们应该如何转换它？现在，由于即使我们简单地说"修饰符"也有各种类型的修饰符，让我们对它们进行分类，以便我们可以考虑未来的可能性。

这次，我们将实现"事件修饰符"。让我们首先将其提取为 `eventModifiers`。

```ts
const isEventModifier = makeMap(
  // 事件传播管理
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

现在我们已经提取了 `eventModifiers`，我们应该如何使用它？总之，我们将在 runtime-dom 端实现一个名为 `withModifiers` 的辅助函数，并将其转换为调用该函数的表达式。

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

通过这样，转换器的实现几乎完成了。

现在让我们在 compiler-dom 端实现 `withModifiers`。

## `withModifiers` 的实现

让我们在 runtime-dom/directives/vOn.ts 中继续实现。

实现非常简单。

为事件修饰符实现一个保护函数，并实现它，使其运行与数组中接收的修饰符数量一样多的次数。

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

这就是实现的结束。

让我们检查操作！如果按下按钮时输入内容反映在屏幕上而页面没有重新加载，就可以了！

到此为止的源代码：[GitHub](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/027_event_modifier)

## 其他修饰符

现在我们已经走到这一步，让我们实现其他修饰符。

基本的实现方法是相同的。

让我们按如下方式对修饰符进行分类：

```ts
const keyModifiers = []
const nonKeyModifiers = []
const eventOptionModifiers = []
```

然后，生成必要的映射并用 `resolveModifiers` 对它们进行分类。

需要注意的两点是：

- 修饰符名称和实际 DOM API 名称之间的差异
- 实现一个新的辅助函数来执行特定的键事件（withKeys）

请在阅读实际代码的同时尝试实现！
如果你已经走到这一步，你应该能够做到。

到此为止的源代码：[GitHub](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/027_event_modifier2)
