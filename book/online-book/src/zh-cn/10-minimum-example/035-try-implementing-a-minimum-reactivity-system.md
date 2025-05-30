# 尝试实现最小响应式系统

## 使用 Proxy 的响应式机制

::: info 与当前 `vuejs/core` 设计的差异
截至 2024 年 12 月，Vue.js 的响应式系统采用基于双向链表的观察者模式。\
这个实现在 [Refactor reactivity system to use version counting and doubly-linked list tracking](https://github.com/vuejs/core/pull/10397) 中引入，对性能改进做出了重大贡献。  

然而，对于第一次实现响应式系统的人来说，这可能有些难以理解。在本章中，我们将创建传统（优化前）系统的简化实现。\
有关更接近当前实现的系统的更详细解释，请参考 [响应式优化](/30-basic-reactivity-system/005-reactivity-optimization)。  

另一个重大改进 [feat(reactivity): more efficient reactivity system](https://github.com/vuejs/core/pull/5912) 将在单独的章节中介绍。  
:::

为了再次明确目的，这次的目的是"在状态改变时执行 `updateComponent`"。让我使用 Proxy 解释实现过程。

首先，Vue.js 的响应式系统涉及 `target`、`Proxy`、`ReactiveEffect`、`Dep`、`track`、`trigger`、`targetMap` 和 `activeEffect`（目前是 `activeSub`）。

首先，让我们谈谈 targetMap 的结构。
targetMap 是某个目标的键和 deps 的映射。
Target 指的是您想要使其响应式的对象，dep 指的是您想要执行的效果（函数）。您可以这样想。
在代码中，它看起来像这样：

```ts
type Target = any // 任何目标
type TargetKey = any // 目标拥有的任何键

const targetMap = new WeakMap<Target, KeyToDepMap>() // 在此模块中定义为全局变量

type KeyToDepMap = Map<TargetKey, Dep> // 目标的键和效果的映射

type Dep = Set<ReactiveEffect> // dep 有多个 ReactiveEffects

class ReactiveEffect {
  constructor(
    // 这里，您给出想要实际应用为效果的函数（在这种情况下是 updateComponent）
    public fn: () => T,
  ) {}
}
```

这意味着为"某个目标（对象）"的"某个键"注册"某个效果"。

仅仅看代码可能很难理解，所以这里有一个具体的例子和补充图表。\
考虑如下组件：

```ts
export default defineComponent({
  setup() {
    const state1 = reactive({ name: "John", age: 20 })
    const state2 = reactive({ count: 0 })

    function onCountUpdated() {
      console.log("count updated")
    }

    watch(() => state2.count, onCountUpdated)

    return () => h("p", {}, `name: ${state1.name}`)
  }
})
```

虽然我们在本章中还没有实现 `watch`，但为了说明而写在这里。\
在这个组件中，targetMap 最终将形成如下：

![target_map](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/target_map.drawio.png)

targetMap 的键是"某个目标"。在这个例子中，state1 和 state2 对应于此。\
这些目标拥有的键成为 targetMap 的键。
与它们关联的效果成为值。

在部分 `() => h("p", {}, name: ${state1.name})` 中，映射 `state1->name->updateComponentFn` 被注册，在部分 `watch(() => state2.count, onCountUpdated)` 中，映射 `state2->count->onCountUpdated` 被注册。

这个基本结构负责其余部分，然后我们考虑如何创建（注册）targetMap 以及如何执行效果。

这就是 `track` 和 `trigger` 概念的用武之地。
顾名思义，`track` 是在 `targetMap` 中注册的函数，`trigger` 是从 `targetMap` 检索效果并执行它的函数。

```ts
export function track(target: object, key: unknown) {
  // ..
}

export function trigger(target: object, key?: unknown) {
  // ..
}
```

这些 `track` 和 `trigger` 在 Proxy 的 get 和 set 处理器中实现。

```ts
const state = new Proxy(
  { count: 1 },
  {
    get(target, key, receiver) {
      track(target, key)
      return target[key]
    },
    set(target, key, value, receiver) {
      target[key] = value
      trigger(target, key)
      return true
    },
  },
)
```

生成此 Proxy 的 API 是 reactive 函数。

```ts
function reactive<T>(target: T) {
  return new Proxy(target, {
    get(target, key, receiver) {
      track(target, key)
      return target[key]
    },
    set(target, key, value, receiver) {
      target[key] = value
      trigger(target, key)
      return true
    },
  })
}
```

![reactive](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/reactive.drawio.png)

在这里，您可能会注意到一个缺失的元素。那就是"在 track 中注册哪个函数？"。
答案是 `activeEffect` 的概念。
这也像 targetMap 一样在此模块中定义为全局变量，并在 ReactiveEffect 的 `run` 方法中设置。

```ts
let activeEffect: ReactiveEffect | undefined

class ReactiveEffect {
  constructor(
    // 这里，您给出想要实际应用为效果的函数（在这种情况下是 updateComponent）
    public fn: () => T,
  ) {}

  run() {
    activeEffect = this
    return this.fn()
  }
}
```

要理解它是如何工作的，想象一个这样的组件。

```ts
{
  setup() {
    const state = reactive({ count: 0 });
    const increment = () => state.count++;

    return function render() {
      return h("div", { id: "my-app" }, [
        h("p", {}, [`count: ${state.count}`]),
        h(
          "button",
          {
            onClick: increment,
          },
          ["increment"]
        ),
      ]);
    };
  },
}
```

在内部，响应式是这样形成的。

```ts
// chibivue 内部的实现
const app: App = {
  mount(rootContainer: HostElement) {
    const componentRender = rootComponent.setup!()

    const updateComponent = () => {
      const vnode = componentRender()
      render(vnode, rootContainer)
    }

    const effect = new ReactiveEffect(updateComponent)
    effect.run()
  },
}
```

逐步解释，首先执行 `setup` 函数。\
此时生成响应式代理。换句话说，在此处创建的代理上执行的任何操作都将按照代理中配置的方式运行。

```ts
const state = reactive({ count: 0 }) // 生成代理
```

接下来，我们传递 `updateComponent` 来创建 `ReactiveEffect`（观察者端）。

```ts
const effect = new ReactiveEffect(updateComponent)
```

在 `updateComponent` 中使用的 `componentRender` 是 `setup` 的 `返回值` 的函数，这个函数引用由代理创建的对象。

```ts
function render() {
  return h('div', { id: 'my-app' }, [
    h('p', {}, [`count: ${state.count}`]), // 引用由代理创建的对象
    h(
      'button',
      {
        onClick: increment,
      },
      ['increment'],
    ),
  ])
}
```

当这个函数实际执行时，`state.count` 的 `getter` 函数被执行，`track` 被触发。
在这种情况下，让我们执行效果。

```ts
effect.run()
```

然后，`updateComponent`（带有 `updateComponent` 的 ReactiveEffect）被设置为 `activeEffect`。
当在此状态下触发 `track` 时，`state.count` 和 `updateComponent`（带有 `updateComponent` 的 ReactiveEffect）的映射在 `targetMap` 中注册。
这就是响应式的形成方式。

现在，让我们考虑执行 `increment` 时会发生什么。
由于 `increment` 正在重写 `state.count`，`setter` 被执行，`trigger` 被触发。
`trigger` 基于 `state` 和 `count` 从 `targetMap` 中找到并执行 `effect`（在这种情况下是 updateComponent）。
这就是屏幕更新的触发方式！

这使我们能够实现响应式。

这有点复杂，所以让我们用图表总结一下。

![reactivity_create](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/reactivity_create.drawio.png)

## 基于这些，让我们实现它。

最困难的部分是理解到这一点的一切，所以一旦您理解了，您所要做的就是编写源代码。
然而，即使您只理解上述内容，可能有些人在不知道实际发生什么的情况下无法理解。
对于这些人，让我们首先在这里尝试实现它。然后，在阅读实际代码时，请参考前面的部分！

首先，让我们创建必要的文件。我们将在 `packages/reactivity` 中创建它们。
在这里，我们将尽可能地意识到原始 Vue 的配置。

```sh
pwd # ~
mkdir packages/reactivity

touch packages/reactivity/index.ts

touch packages/reactivity/dep.ts
touch packages/reactivity/effect.ts
touch packages/reactivity/reactive.ts
touch packages/reactivity/baseHandler.ts
```

像往常一样，`index.ts` 只是导出，所以我不会详细解释。在这里导出您想要从 reactivity 外部包使用的内容。

接下来是 `dep.ts`。

```ts
import { type ReactiveEffect } from './effect'

export type Dep = Set<ReactiveEffect>

export const createDep = (effects?: ReactiveEffect[]): Dep => {
  const dep: Dep = new Set<ReactiveEffect>(effects)
  return dep
}
```

还没有 `effect` 的定义，但我们稍后会实现它，所以没关系。

接下来是 `effect.ts`。

```ts
import { Dep, createDep } from './dep'

type KeyToDepMap = Map<any, Dep>
const targetMap = new WeakMap<any, KeyToDepMap>()

export let activeEffect: ReactiveEffect | undefined

export class ReactiveEffect<T = any> {
  constructor(public fn: () => T) {}

  run() {
    // ※ 在执行 fn 之前保存 activeEffect，执行后恢复它。
    // 如果您不这样做，它将一个接一个地被覆盖并表现出意外行为。（完成后让我们将其恢复到原始状态）
    let parent: ReactiveEffect | undefined = activeEffect
    activeEffect = this
    const res = this.fn()
    activeEffect = parent
    return res
  }
}

export function track(target: object, key: unknown) {
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }

  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = createDep()))
  }

  if (activeEffect) {
    dep.add(activeEffect)
  }
}

export function trigger(target: object, key?: unknown) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  const dep = depsMap.get(key)

  if (dep) {
    const effects = [...dep]
    for (const effect of effects) {
      effect.run()
    }
  }
}
```

到目前为止我还没有解释 `track` 和 `trigger` 的内容，但它们只是从 `targetMap` 注册和检索并执行它们，所以请尝试仔细阅读它们。

接下来是 `baseHandler.ts`。在这里，我们定义响应式代理的处理器。
嗯，您可以直接在 `reactive` 中实现它，但我遵循了原始 Vue，因为它是这样的。
实际上，有各种代理，如 `readonly` 和 `shallow`，所以想法是在这里实现这些代理的处理器。（虽然这次我们不会这样做）

```ts
import { track, trigger } from './effect'
import { reactive } from './reactive'

export const mutableHandlers: ProxyHandler<object> = {
  get(target: object, key: string | symbol, receiver: object) {
    track(target, key)

    const res = Reflect.get(target, key, receiver)
    // 如果它是一个对象，使其响应式（这也允许嵌套对象是响应式的）。
    if (res !== null && typeof res === 'object') {
      return reactive(res)
    }

    return res
  },

  set(target: object, key: string | symbol, value: unknown, receiver: object) {
    let oldValue = (target as any)[key]
    Reflect.set(target, key, value, receiver)
    // 检查值是否已更改
    if (hasChanged(value, oldValue)) {
      trigger(target, key)
    }
    return true
  },
}

const hasChanged = (value: any, oldValue: any): boolean =>
  !Object.is(value, oldValue)
```

在这里，出现了 `Reflect`，它类似于 `Proxy`，但 `Proxy` 是为对象编写元设置，而 `Reflect` 是对现有对象执行操作。
`Proxy` 和 `Reflect` 都是 JS 引擎中与对象相关的元编程 API，它们允许您与正常使用对象相比执行元操作。
您可以执行更改对象的函数，执行读取对象的函数，检查键是否存在，并执行各种元操作。
现在，可以理解 `Proxy` 是在创建对象阶段的元设置，`Reflect` 是对现有对象的元操作。

接下来是 `reactive.ts`。

```ts
import { mutableHandlers } from './baseHandler'

export function reactive<T extends object>(target: T): T {
  const proxy = new Proxy(target, mutableHandlers)
  return proxy as T
}
```

现在 `reactive` 的实现完成了，让我们尝试在挂载时使用它们。
`~/packages/runtime-core/apiCreateApp.ts`。

```ts
import { ReactiveEffect } from '../reactivity'

export function createAppAPI<HostElement>(
  render: RootRenderFunction<HostElement>,
): CreateAppFunction<HostElement> {
  return function createApp(rootComponent) {
    const app: App = {
      mount(rootContainer: HostElement) {
        const componentRender = rootComponent.setup!()

        const updateComponent = () => {
          const vnode = componentRender()
          render(vnode, rootContainer)
        }

        // 从这里
        const effect = new ReactiveEffect(updateComponent)
        effect.run()
        // 到这里
      },
    }

    return app
  }
}
```

现在，让我们在游乐场中尝试它。

```ts
import { createApp, h, reactive } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({ count: 0 })
    const increment = () => {
      state.count++
    }

    return function render() {
      return h('div', { id: 'my-app' }, [
        h('p', {}, [`count: ${state.count}`]),
        h('button', { onClick: increment }, ['increment']),
      ])
    }
  },
})

app.mount('#app')
```

哎呀...

渲染现在工作正常，但似乎有些不对劲。
嗯，这并不奇怪，因为在 `updateComponent` 中，我们每次都创建元素。
所以，让我们在每次渲染之前删除所有元素。

![reactive_example_mistake](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/reactive_example_mistake.png)

像这样修改 `~/packages/runtime-core/renderer.ts` 中的 `render` 函数：

```ts
const render: RootRenderFunction = (vnode, container) => {
  while (container.firstChild) container.removeChild(container.firstChild) // 添加代码以删除所有元素
  const el = renderVNode(vnode)
  hostInsert(el, container)
}
```

现在，这样如何？

![reactive_example](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/reactive_example.png)

现在似乎工作正常！

现在我们可以使用 `reactive` 更新屏幕！

到此为止的源代码：[GitHub](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/030_reactive_system)
