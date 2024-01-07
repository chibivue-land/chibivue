# ビットによる VNode の表現

## VNode の種類をビットで表現する

VNode にはいろんな種類のものがあります。例えば、今実装しているものだと、以下のようなものです。

- component node
- element node
- text node
- 子要素が text かどうか
- 子要素が配列かどうか

そして、これから先はさらにいろんな種類の Vnode が追加実装されることでしょう。  
例えば、slot, keep-alive, suspense, teleport などがそうです。

今のところ、`type === Text` や `typeof type === "string"`, `typeof type === "object"` などで分岐をおこなっています。

これらをいちいち判定するのは非効率ですし、本家の実装に倣ってビットで表現することにしてみましょう。  
Vue ではこれらのビットは `ShapeFlags` と呼ばれています。その名の通り、VNode の Shape を表すものです。  
(厳密には Vue ではこの ShapeFlags と Text や Fragment などの Symbol を使って VNode の種類を判別しています)  
https://github.com/vuejs/core/blob/main/packages/shared/src/shapeFlags.ts

ビットフラグがどのようなものかというと、数値の各ビットを特定のフラグとしてみなすというものです。

例として以下のような VNode を考えます。

```ts
const vnode = {
  type: 'div',
  children: [
    { type: 'p', children: ['hello'] },
    { type: 'p', children: ['hello'] },
  ],
}
```

まず、フラグの初期値は 0 です。(簡略化のため 8bit で説明しています。)

```ts
let shape = 0b0000_0000
```

ここで、この VNode は element であり、子要素を配列で持っているので ELEMENT というフラグと ARRAY_CHILDREN というフラグが立ちます。

```ts
shape = shape | ShapeFlags.ELEMENT | ELEMENT.ARRAY_CHILDREN // 0x00010001
```

これにより、shape というただ一つの数値で「element でありかつ、子要素を配列を持っている」という情報を表現できました。  
あとはこれを renderer 等の分岐で使用すれば効率的に VNode の種類を管理できます。

```ts
if (vnode.shape & ShapeFlags.ELEMENT) {
  // vnodeがelementの時の処理
}
```

今回は、すべての ShapeFlags を実装するわけではないので、練習として以下を実装してみてください。

```ts
export const enum ShapeFlags {
  ELEMENT = 1,
  COMPONENT = 1 << 2,
  TEXT_CHILDREN = 1 << 3,
  ARRAY_CHILDREN = 1 << 4,
}
```

やることとしては、

- shared/shapeFlags.ts にフラグを定義
- runtime-core/vnode.ts で vnode に shape を定義
  ```ts
  export interface VNode<HostNode = any> {
    shapeFlag: number
  }
  ```
  を追加し、createVNode などで flag を算出してください。
- renderer では shape を元に分岐処理を実装する。

です!

なんとこのチャプターの説明は以上です。実際に実装していきましょう !
