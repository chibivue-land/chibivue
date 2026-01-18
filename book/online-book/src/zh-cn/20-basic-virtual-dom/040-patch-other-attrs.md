# 无法处理的 Props 的补丁

在本章中，让我们为目前无法处理的 Props 实现补丁．
以下是一些需要处理的 Props 示例，但请尝试通过参考原始实现来实现它们，同时自己填补缺失的部分！
通过这样做，它应该变得更加实用！

没有什么特别新的东西．基于我们到目前为止所做的，应该能够充分实现它．

我想关注的是 runtime-dom/modules 的实现．

## 新旧比较

目前，更新只能基于 n2 的 props 进行．
让我们基于 n1 和 n2 进行更新．

```ts
const oldProps = n1.props || {}
const newProps = n2.props || {}
```

存在于 n1 但不存在于 n2 中的 Props 应该被删除．
另外，如果即使两者都存在但值相同，也不需要补丁，所以跳过它．

## class / style（注意）

有多种绑定 class 和 style 的方法．

```html
<p class="static property">hello</p>
<p :class="'dynamic property'">hello</p>
<p :class="['dynamic', 'property', 'array']">hello</p>
<p :class="{ dynamic: true, property: true, array: true}">hello</p>
<p class="static property" :class="'mixed dynamic property'">hello</p>
<p style="static: true;" :style="{ mixed-dynamic: 'true' }">hello</p>
```

要实现这些，需要在基础模板编译器部分解释的 `transform` 概念．
只要不偏离原始 Vue 的设计，它可以在任何地方实现，但我们在这里跳过它，因为我们想在本书中遵循原始 Vue 的设计．

## innerHTML / textContent

innerHTML 和 textContent 与其他 Props 相比有点特殊．\
这是因为如果具有此 Prop 的元素有子元素，它们需要被卸载．

例如，考虑以下情况：

```ts
h('div', { innerHTML: '<p>hello</p>' }, [
  h(SomeComponent, {}, [])
])
```

在这种情况下，div 元素的内容将被 `innerHTML` 覆盖为 `<p>hello</p>`．\
然而，作为 children 传递的 `SomeComponent` 已经存在于虚拟 DOM 中，如果不正确卸载它，将会发生以下问题：

- 事件监听器不会被移除
- 组件生命周期钩子（如 onUnmounted）不会被调用
- 可能导致内存泄漏

因此，在设置 innerHTML 或 textContent 时，需要卸载现有的子元素．

### 实现

首先，扩展 `patchProp` 的类型定义以接受 `prevChildren` 和 `unmountChildren`．

`~/packages/runtime-core/renderer.ts`

```ts
export interface RendererOptions<HostNode = RendererNode, HostElement = RendererElement> {
  patchProp(
    el: HostElement,
    key: string,
    prevValue: any,
    nextValue: any,
    prevChildren?: VNode<HostNode>[], // 添加
    unmountChildren?: (children: VNode<HostNode>[]) => void, // 添加
  ): void;
  // ...
}
```

接下来，在 `patchDOMProp` 函数中实现 innerHTML/textContent 的处理．

`~/packages/runtime-dom/modules/props.ts`

```ts
export function patchDOMProp(
  el: any,
  key: string,
  value: any,
  prevChildren: any,
  unmountChildren: any,
) {
  if (key === 'innerHTML' || key === 'textContent') {
    // 如果存在子元素则卸载
    if (prevChildren) {
      unmountChildren(prevChildren)
    }
    el[key] = value == null ? '' : value
    return
  }

  // ... (其他 props 的处理)
}
```

然后，在从 `patchProp` 调用 `patchDOMProp` 时传递 `prevChildren` 和 `unmountChildren`．

`~/packages/runtime-dom/patchProp.ts`

```ts
export const patchProp: DOMRendererOptions['patchProp'] = (
  el,
  key,
  prevValue,
  nextValue,
  prevChildren,
  unmountChildren,
) => {
  if (key === 'style') {
    patchStyle(el, prevValue, nextValue)
  } else if (isOn(key)) {
    patchEvent(el, key, nextValue)
  } else if (shouldSetAsProp(el, key)) {
    patchDOMProp(el, key, nextValue, prevChildren, unmountChildren) // 传递 prevChildren, unmountChildren
  } else {
    patchAttr(el, key, nextValue)
  }
}
```

最后，在 renderer.ts 中调用 `hostPatchProp` 时传递适当的参数．

`~/packages/runtime-core/renderer.ts` 的 `mountElement` 和 `patchElement`

```ts
const mountElement = (vnode: VNode, container: RendererElement, anchor: RendererElement | null) => {
  let el: RendererElement
  const { type, props } = vnode
  el = vnode.el = hostCreateElement(type as string)

  mountChildren(vnode.children as VNode[], el, anchor)

  if (props) {
    for (const key in props) {
      hostPatchProp(
        el,
        key,
        null,
        props[key],
        vnode.children as VNode[], // 添加
        unmountChildren, // 添加
      )
    }
  }

  hostInsert(el, container)
}
```

现在，当使用 innerHTML 或 textContent 时，现有的子元素将被正确卸载．

到此为止的源代码：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/20_basic_virtual_dom/060_other_props)
