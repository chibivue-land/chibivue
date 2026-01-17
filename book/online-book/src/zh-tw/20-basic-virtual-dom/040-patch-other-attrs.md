# 無法處理的 Props 的補丁

在本章中，讓我們為目前無法處理的 Props 實現補丁．
以下是一些需要處理的 Props 示例，但請嘗試透過參考原始實現來實現它們，同時自己填補缺失的部分！
透過這樣做，它應該變得更加實用！

沒有什麼特別新的東西．基於我們到目前為止所做的，應該能夠充分實現它．

我想關注的是 runtime-dom/modules 的實現．

## 新舊比較

目前，更新只能基於 n2 的 props 進行．
讓我們基於 n1 和 n2 進行更新．

```ts
const oldProps = n1.props || {}
const newProps = n2.props || {}
```

存在於 n1 但不存在於 n2 中的 Props 應該被刪除．
另外，如果即使兩者都存在但值相同，也不需要補丁，所以跳過它．

## class / style（注意）

有多種綁定 class 和 style 的方法．

```html
<p class="static property">hello</p>
<p :class="'dynamic property'">hello</p>
<p :class="['dynamic', 'property', 'array']">hello</p>
<p :class="{ dynamic: true, property: true, array: true}">hello</p>
<p class="static property" :class="'mixed dynamic property'">hello</p>
<p style="static: true;" :style="{ mixed-dynamic: 'true' }">hello</p>
```

要實現這些，需要在基礎模板編譯器部分解釋的 `transform` 概念．
只要不偏離原始 Vue 的設計，它可以在任何地方實現，但我們在這裡跳過它，因為我們想在本書中遵循原始 Vue 的設計．

## innerHTML / textContent

innerHTML 和 textContent 與其他 Props 相比有點特殊．\
這是因為如果具有此 Prop 的元素有子元素，它們需要被卸載．

例如，考慮以下情況：

```ts
h('div', { innerHTML: '<p>hello</p>' }, [
  h(SomeComponent, {}, [])
])
```

在這種情況下，div 元素的內容將被 `innerHTML` 覆蓋為 `<p>hello</p>`．\
然而，作為 children 傳遞的 `SomeComponent` 已經存在於虛擬 DOM 中，如果不正確卸載它，將會發生以下問題：

- 事件監聽器不會被移除
- 組件生命週期鉤子（如 onUnmounted）不會被調用
- 可能導致記憶體洩漏

因此，在設定 innerHTML 或 textContent 時，需要卸載現有的子元素．

### 實現

首先，擴展 `patchProp` 的類型定義以接受 `prevChildren` 和 `unmountChildren`．

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

接下來，在 `patchDOMProp` 函式中實現 innerHTML/textContent 的處理．

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
    // 如果存在子元素則卸載
    if (prevChildren) {
      unmountChildren(prevChildren)
    }
    el[key] = value == null ? '' : value
    return
  }

  // ... (其他 props 的處理)
}
```

然後，在從 `patchProp` 調用 `patchDOMProp` 時傳遞 `prevChildren` 和 `unmountChildren`．

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
    patchDOMProp(el, key, nextValue, prevChildren, unmountChildren) // 傳遞 prevChildren, unmountChildren
  } else {
    patchAttr(el, key, nextValue)
  }
}
```

最後，在 renderer.ts 中調用 `hostPatchProp` 時傳遞適當的參數．

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

現在，當使用 innerHTML 或 textContent 時，現有的子元素將被正確卸載．

到此為止的原始碼：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/20_basic_virtual_dom/060_other_props)
