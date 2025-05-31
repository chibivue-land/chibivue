# 实现 Fragment

## 当前实现的问题

让我们尝试在游乐场中运行以下代码：

```ts
import { createApp, defineComponent } from 'chibivue'

const App = defineComponent({
  template: `<header>header</header>
<main>main</main>
<footer>footer</footer>`,
})

const app = createApp(App)

app.mount('#app')
```

你可能会遇到这样的错误：

![fragment_error.png](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/fragment_error.png)

查看错误消息，似乎与 Function 构造函数有关。

换句话说，代码生成似乎在某种程度上是成功的，所以让我们看看实际生成了什么代码。

```ts
return function render(_ctx) {
  with (_ctx) {
    const { createVNode: _createVNode } = ChibiVue

    return _createVNode("header", null, "header")"\n  "_createVNode("main", null, "main")"\n  "_createVNode("footer", null, "footer")
   }
}
```

`return` 语句后的代码是不正确的。当前的代码生成实现不处理根是数组（即不是单个节点）的情况。

我们将修复这个问题。

## 应该生成什么代码？

即使我们正在进行修改，应该生成什么样的代码？

总之，代码应该看起来像这样：

```ts
return function render(_ctx) {
  with (_ctx) {
    const { createVNode: _createVNode, Fragment: _Fragment } = ChibiVue

    return _createVNode(_Fragment, null, [
      [
        _createVNode('header', null, 'header'),
        '\n  ',
        _createVNode('main', null, 'main'),
        '\n  ',
        _createVNode('footer', null, 'footer'),
      ],
    ])
  }
}
```

这个 `Fragment` 是在 Vue 中定义的符号。

换句话说，Fragment 不像 FragmentNode 那样表示为 AST，而是简单地作为 ElementNode 的标签。

我们将在渲染器中实现 Fragment 的处理，类似于 Text。

## 实现

Fragment 符号将在 runtime-core/vnode.ts 中实现。

让我们将其作为 VNodeTypes 中的新类型添加。

```ts
export type VNodeTypes = Component | typeof Text | typeof Fragment | string

export const Fragment = Symbol()
```

实现渲染器。

在 patch 函数中为 fragment 添加分支。

```ts
if (type === Text) {
  processText(n1, n2, container, anchor)
} else if (shapeFlag & ShapeFlags.ELEMENT) {
  processElement(n1, n2, container, anchor, parentComponent)
} else if (type === Fragment) {
  // 这里
  processFragment(n1, n2, container, anchor, parentComponent)
} else if (shapeFlag & ShapeFlags.COMPONENT) {
  processComponent(n1, n2, container, anchor, parentComponent)
} else {
  // do nothing
}
```

注意插入或删除元素通常应该用 anchor 作为标记来实现。

顾名思义，anchor 表示 fragment 的开始和结束位置。

起始元素由 VNode 中现有的 `el` 属性表示，但目前没有表示结束的属性。让我们添加它。

```ts
export interface VNode<HostNode = any> {
  // .
  // .
  // .
  anchor: HostNode | null // fragment anchor // 添加
  // .
  // .
}
```

在挂载期间设置 anchor。

在 mount/patch 中将 fragment 的结束作为 anchor 传递。

```ts
const processFragment = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
) => {
  const fragmentStartAnchor = (n2.el = n1 ? n1.el : hostCreateText(''))!
  const fragmentEndAnchor = (n2.anchor = n1 ? n1.anchor : hostCreateText(''))!

  if (n1 == null) {
    hostInsert(fragmentStartAnchor, container, anchor)
    hostInsert(fragmentEndAnchor, container, anchor)
    mountChildren(
      n2.children as VNode[],
      container,
      fragmentEndAnchor,
      parentComponent,
    )
  } else {
    patchChildren(n1, n2, container, fragmentEndAnchor, parentComponent)
  }
}
```

当 fragment 的元素在更新期间发生变化时要小心。

```ts
const move = (
  vnode: VNode,
  container: RendererElement,
  anchor: RendererElement | null,
) => {
  const { type, children, el, shapeFlag } = vnode

  // .

  if (type === Fragment) {
    hostInsert(el!, container, anchor)
    for (let i = 0; i < (children as VNode[]).length; i++) {
      move((children as VNode[])[i], container, anchor)
    }
    hostInsert(vnode.anchor!, container, anchor) // 插入 anchor
    return
  }
  // .
  // .
  // .
}
```

在卸载期间，也依赖 anchor 来删除元素。

```ts
const remove = (vnode: VNode) => {
  const { el, type, anchor } = vnode
  if (type === Fragment) {
    removeFragment(el!, anchor!)
  }

  // .
  // .
  // .
}

const removeFragment = (cur: RendererNode, end: RendererNode) => {
  let next
  while (cur !== end) {
    next = hostNextSibling(cur)! // ※ 将此添加到 nodeOps！
    hostRemove(cur)
    cur = next
  }
  hostRemove(end)
}
```

## 测试

我们之前编写的代码应该正确工作。

```ts
import { Fragment, createApp, defineComponent, h, ref } from 'chibivue'

const App = defineComponent({
  template: `<header>header</header>
<main>main</main>
<footer>footer</footer>`,
})

const app = createApp(App)

app.mount('#app')
```

目前，我们不能使用像 v-for 这样的指令，所以我们不能编写在模板中使用 fragment 并改变元素数量的描述。

让我们通过编写编译后的代码来模拟行为，看看它是如何工作的。

```ts
import { Fragment, createApp, defineComponent, h, ref } from 'chibivue'

// const App = defineComponent({
//   template: `<header>header</header>
//   <main>main</main>
//   <footer>footer</footer>`,
// });

const App = defineComponent({
  setup() {
    const list = ref([0])
    const update = () => {
      list.value = [...list.value, list.value.length]
    }
    return () =>
      h(Fragment, {}, [
        h('button', { onClick: update }, 'update'),
        ...list.value.map(i => h('div', {}, i)),
      ])
  },
})

const app = createApp(App)

app.mount('#app')
```

看起来工作正常！

到此为止的源代码：[GitHub](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/030_fragment)
