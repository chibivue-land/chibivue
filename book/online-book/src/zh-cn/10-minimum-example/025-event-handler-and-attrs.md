# 让我们支持事件处理器和属性

## 仅仅显示有点孤单

既然有机会，让我们实现 props，这样我们就可以使用点击事件和样式。

关于这部分，虽然直接在 renderVNode 中实现也可以，但让我们尝试在考虑遵循原始设计的同时进行。

请注意原始 Vue.js 的 runtime-dom 目录。

https://github.com/vuejs/core/tree/main/packages/runtime-dom/src

我希望您特别注意 `modules` 目录和 `patchProp.ts` 文件。

在 modules 目录内，有用于操作类、样式和其他 props 的文件。
https://github.com/vuejs/core/tree/main/packages/runtime-dom/src/modules

这些都在 patchProp.ts 中组合成一个名为 patchProp 的函数，并混合到 nodeOps 中。

与其用文字解释，我将尝试基于这种设计来做。

## 创建 patchProps 的框架

首先，让我们创建框架。

```sh
pwd # ~
touch packages/runtime-dom/patchProp.ts
```

`runtime-dom/patchProp.ts` 的内容

```ts
type DOMRendererOptions = RendererOptions<Node, Element>

const onRE = /^on[^a-z]/
export const isOn = (key: string) => onRE.test(key)

export const patchProp: DOMRendererOptions['patchProp'] = (el, key, value) => {
  if (isOn(key)) {
    // patchEvent(el, key, value); // 我们稍后会实现这个
  } else {
    // patchAttr(el, key, value); // 我们稍后会实现这个
  }
}
```

由于 patchProp 的类型在 RendererOptions 中没有定义，让我们定义它。

```ts
export interface RendererOptions<
  HostNode = RendererNode,
  HostElement = RendererElement
> {
  // 添加
  patchProp(el: HostElement, key: string, value: any): void;
  .
  .
  .
```

这样，我们需要修改 nodeOps 以排除 patchProps 以外的部分。

```ts
// 省略 patchProp
export const nodeOps: Omit<RendererOptions, "patchProp"> = {
  createElement: (tagName) => {
    return document.createElement(tagName);
  },
  .
  .
  .
```

然后，在 `runtime-dom/index` 中生成渲染器时，让我们更改为一起传递 patchProp。

```ts
const { render } = createRenderer({ ...nodeOps, patchProp })
```

## 事件处理器

让我们实现 patchEvent。

```sh
pwd # ~
mkdir packages/runtime-dom/modules
touch packages/runtime-dom/modules/events.ts
```

实现 events.ts。

```ts
interface Invoker extends EventListener {
  value: EventValue
}

type EventValue = Function

export function addEventListener(
  el: Element,
  event: string,
  handler: EventListener,
) {
  el.addEventListener(event, handler)
}

export function removeEventListener(
  el: Element,
  event: string,
  handler: EventListener,
) {
  el.removeEventListener(event, handler)
}

export function patchEvent(
  el: Element & { _vei?: Record<string, Invoker | undefined> },
  rawName: string,
  value: EventValue | null,
) {
  // vei = vue event invokers
  const invokers = el._vei || (el._vei = {})
  const existingInvoker = invokers[rawName]

  if (value && existingInvoker) {
    // patch
    existingInvoker.value = value
  } else {
    const name = parseName(rawName)
    if (value) {
      // add
      const invoker = (invokers[rawName] = createInvoker(value))
      addEventListener(el, name, invoker)
    } else if (existingInvoker) {
      // remove
      removeEventListener(el, name, existingInvoker)
      invokers[rawName] = undefined
    }
  }
}

function parseName(rawName: string): string {
  return rawName.slice(2).toLocaleLowerCase()
}

function createInvoker(initialValue: EventValue) {
  const invoker: Invoker = (e: Event) => {
    invoker.value(e)
  }
  invoker.value = initialValue
  return invoker
}
```

这有点长，但如果您拆分它，这是一个非常简单的代码。

addEventListener 顾名思义，只是一个用于注册事件监听器的函数。\
虽然实际上需要在适当的时机删除它，但我们现在将忽略它。

在 patchEvent 中，我们用一个名为 invoker 的函数包装监听器并注册监听器。\
关于 parseName，它只是通过删除"on"将 prop 键名（如 `onClick` 和 `onInput`）转换为小写（例如 click、input）。
需要注意的一点是，为了不向同一元素添加重复的 addEventListeners，我们将 invoker 添加到名为 `_vei`（vue event invokers）的元素中。\
通过在补丁时更新 existingInvoker.value，我们可以在不添加重复 addEventListeners 的情况下更新处理器。\
术语"invoker"简单地意味着"执行者"。没有更深的含义；它只是一个存储将实际执行的处理器的对象。

现在让我们将其合并到 patchProps 中，并尝试在 renderVNode 中使用它。

patchProps

```ts
export const patchProp: DOMRendererOptions['patchProp'] = (el, key, value) => {
  if (isOn(key)) {
    patchEvent(el, key, value)
  } else {
    // patchAttr(el, key, value); // 我们稍后会实现这个
  }
}
```

runtime-core/renderer.ts 中的 renderVNode

```ts
  const {
    patchProp: hostPatchProp,
    createElement: hostCreateElement,
    createText: hostCreateText,
    insert: hostInsert,
  } = options;
  .
  .
  .
  function renderVNode(vnode: VNode | string) {
    if (typeof vnode === "string") return hostCreateText(vnode);
    const el = hostCreateElement(vnode.type);

    // 这里
    Object.entries(vnode.props).forEach(([key, value]) => {
      hostPatchProp(el, key, value);
    });
    .
    .
    .
```

现在让我们在游乐场中运行它。我将尝试显示一个简单的警报。

```ts
import { createApp, h } from 'chibivue'

const app = createApp({
  render() {
    return h('div', {}, [
      h('p', {}, ['Hello world.']),
      h(
        'button',
        {
          onClick() {
            alert('Hello world!')
          },
        },
        ['click me!'],
      ),
    ])
  },
})

app.mount('#app')
```

我们现在可以使用 h 函数注册事件处理器！

![simple_h_function_event](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/simple_h_function_event.png)

## 尝试支持其他 props

在此之后，只需对 setAttribute 做同样的事情。\
我们将在 `modules/attrs.ts` 中实现这个。\
我希望您自己尝试。答案将在本章末尾的源代码中附上，所以请在那里检查。\
一旦您可以使这段代码工作，您就达到了目标。

```ts
import { createApp, h } from 'chibivue'

const app = createApp({
  render() {
    return h('div', { id: 'my-app' }, [
      h('p', { style: 'color: red; font-weight: bold;' }, ['Hello world.']),
      h(
        'button',
        {
          onClick() {
            alert('Hello world!')
          },
        },
        ['click me!'],
      ),
    ])
  },
})

app.mount('#app')
```

![simple_h_function_attr](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/simple_h_function_attr.png)

现在我们可以处理广泛的 HTML！

到此为止的源代码：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/020_simple_h_function)
