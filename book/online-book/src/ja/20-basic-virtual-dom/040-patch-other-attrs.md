# 対応できていない Props のパッチ

このチャプターでは，現時点で対応できていない Props のパッチを実装していきましょう．  
以下にはいくつか例として対応対象を挙げますが，各自で足りてない所を本家の実装を読みながら実装してみましょう！  
そうすればより実用的なものにグレードアップするはずです！

特に新しいことは出てきません．今までやってきたことで十分実装できるはずです．

注目したいのは，runtime-dom/modules の実装です．

## 新旧の比較

現状だと n2 の props を元にしか更新ができていません．  
n1 と n2 を元に更新しましょう．

```ts
const oldProps = n1.props || {}
const newProps = n2.props || {}
```

n1 に存在していて n2n に存在しない props は削除です．  
また，両者に存在していても値が変わっていなければ patch する必要はないのでスキップします．

## class / style (注意)

class と style には複数のバインディング方法があります．

```html
<p class="static property">hello</p>
<p :class="'dynamic property'">hello</p>
<p :class="['dynamic', 'property', 'array']">hello</p>
<p :class="{ dynamic: true, property: true, array: true}">hello</p>
<p class="static property" :class="'mixed dynamic property'">hello</p>
<p style="static: true;" :style="{ mixed-dynamic: 'true' }">hello</p>
```

これらを実現するには，Basic Template Compiler 部門で説明する `transform` という概念が必要になります．  
本家 Vue の設計に則らなければどこに実装してもいいのですが，本書では本家 Vue の設計に則りたいためここではスキップします．

## innerHTML / textContent

innerHTML と textContent については他の Props と比べて少し特殊です．\
というのもこの Prop を持つ要素が子要素を持っていた場合，unmount する必要があります．

例えば以下のようなケースを考えてみましょう．

```ts
h('div', { innerHTML: '<p>hello</p>' }, [
  h(SomeComponent, {}, [])
])
```

この場合，`innerHTML` によって div 要素の内容が `<p>hello</p>` に上書きされます．\
しかし，children として渡されている `SomeComponent` は既に仮想 DOM 上に存在しており，これを適切にアンマウントしないと以下のような問題が発生します：

- イベントリスナーが解除されない
- コンポーネントのライフサイクルフック（onUnmounted など）が呼ばれない
- メモリリークの原因になる

そのため，innerHTML や textContent を設定する際には，既存の子要素をアンマウントする必要があります．

### 実装

まず，`patchProp` の型定義を拡張して，`prevChildren` と `unmountChildren` を受け取れるようにします．

`~/packages/runtime-core/renderer.ts`

```ts
export interface RendererOptions<HostNode = RendererNode, HostElement = RendererElement> {
  patchProp(
    el: HostElement,
    key: string,
    prevValue: any,
    nextValue: any,
    prevChildren?: VNode<HostNode>[], // 追加
    unmountChildren?: (children: VNode<HostNode>[]) => void, // 追加
  ): void;
  // ...
}
```

次に，`patchDOMProp` 関数で innerHTML/textContent の処理を実装します．

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
    // 既存の子要素がある場合はアンマウント
    if (prevChildren) {
      unmountChildren(prevChildren)
    }
    el[key] = value == null ? '' : value
    return
  }

  // ... (他の props の処理)
}
```

そして，`patchProp` から `patchDOMProp` を呼び出す際に，`prevChildren` と `unmountChildren` を渡します．

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
    patchDOMProp(el, key, nextValue, prevChildren, unmountChildren) // prevChildren, unmountChildren を渡す
  } else {
    patchAttr(el, key, nextValue)
  }
}
```

最後に，renderer.ts で `hostPatchProp` を呼び出す際に，適切に引数を渡します．

`~/packages/runtime-core/renderer.ts` の `mountElement` と `patchElement`

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
        vnode.children as VNode[], // 追加
        unmountChildren, // 追加
      )
    }
  }

  hostInsert(el, container)
}
```

これで innerHTML や textContent を使用した際に，既存の子要素が適切にアンマウントされるようになります．

ここまでのソースコード：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/20_basic_virtual_dom/060_other_props)
