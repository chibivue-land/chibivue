# イベントハンドラや属性に対応してみる

## 表示するだけでは寂しいので

せっかくなので props の実装をしてクリックイベントや style を使えるようにしてみます．

この部分について，直接 renderVNode に実装してしまってもいいのですが，本家に倣った設計も考慮しつつ進めてみようかと思います．

本家 Vue.js の runtime-dom ディテクトリに注目してください．

https://github.com/vuejs/core/tree/main/packages/runtime-dom/src

特に注目して欲しいのは `modules` というディレクトリと `patchProp.ts` というファイルです．

modules の中には class や style, その他 props の操作をするためのファイルが実装されています．
https://github.com/vuejs/core/tree/main/packages/runtime-dom/src/modules

それらを patchProp という関数にまとめているのが patchProp.ts で，これを nodeOps に混ぜ込んでいます．

言葉で説明するのも何なので，実際にこの設計に基づいてやってみようと思います．

## patchProps のガワを作成

まずガワから作ります．

```sh
pwd # ~
touch packages/runtime-dom/patchProp.ts
```

`runtime-dom/patchProp.ts` の内容

```ts
type DOMRendererOptions = RendererOptions<Node, Element>

const onRE = /^on[^a-z]/
export const isOn = (key: string) => onRE.test(key)

export const patchProp: DOMRendererOptions['patchProp'] = (el, key, value) => {
  if (isOn(key)) {
    // patchEvent(el, key, value); // これから実装します
  } else {
    // patchAttr(el, key, value); // これから実装します
  }
}
```

`RendererOptions` に patchProp の型がないので定義します．

```ts
export interface RendererOptions<
  HostNode = RendererNode,
  HostElement = RendererElement
> {
  // 追加
  patchProp(el: HostElement, key: string, value: any): void;
  .
  .
  .
```

それに伴って，nodeOps では patchProps 以外の部分を使用するように書き換えます．

```ts
// patchPropをomitする
export const nodeOps: Omit<RendererOptions, "patchProp"> = {
  createElement: (tagName) => {
    return document.createElement(tagName);
  },
  .
  .
  .
```

そして，`runtime-dom/index`の renderer を生成する際に patchProp も一緒に渡すように変更します．

```ts
const { render } = createRenderer({ ...nodeOps, patchProp })
```

## イベントハンドラ

patchEvent を実装します．

```sh
pwd # ~
mkdir packages/runtime-dom/modules
touch packages/runtime-dom/modules/events.ts
```

events.ts を実装します．

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

少し大きいですが，分割すればとても単純なことです．

addEventListener は名前の通り，ただイベントのリスナーを登録するための関数です．  
本当は然るべきタイミングで remove する必要があるのですが，ここでは一旦気にしないことにします．

patchEvent では invoker という関数でラップしてリスナーを登録しています．  
parseName に関しては，単純に props のキー名は `onClick` や `onInput` のようになっているので，それらを on を除いた小文字に変換しているだけです．(eg. click, input)  
一点注意点としては，同じ要素に対して重複して addEventListener しないように，要素に `_vei` (vue event invokers)という名前で invoker を生やしてあげます．  
これによって patch 時に existingInvoker.value を更新することで重複して addEventListener せずにハンドラを更新することができます．

あとは patchProps に組み込んで renderVNode で使ってみましょう．

patchProps

```ts
export const patchProp: DOMRendererOptions['patchProp'] = (el, key, value) => {
  if (isOn(key)) {
    patchEvent(el, key, value)
  } else {
    // patchAttr(el, key, value); // これから実装します
  }
}
```

runtime-core/renderer.ts の renderVNode

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

    // ここ
    Object.entries(vnode.props).forEach(([key, value]) => {
      hostPatchProp(el, key, value);
    });
    .
    .
    .
```

さて，playground で動かしてみましょう．簡単にアラートを表示してみようと思います．

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

h 関数でイベントハンドラを登録できるようになりました!

![simple_h_function_event](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/simple_h_function_event.png)

## 他の Props にも対応してみる．

あとは同じようなことを setAttribute でやるだけです．  
これは `modules/attrs.ts` に実装します．  
ここはぜひみなさんでやってみてください．答えは最後にこのチャプターのソースコードを添付するのでそこで確認してみてください．  
これくらいのコードが動くようになればゴールです．

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

これでかなりの HTML に対応することができました!

ここまでのソースコード:  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/020_simple_h_function)
