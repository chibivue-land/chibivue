# 小さい Virtual DOM

## Virtual DOM、何に使われる?

前のチャプターで Reactivity System を導入したことで画面を動的に更新できるようになりました。
改めて現在の render 関数の内容を見てみましょう。

```ts
const render: RootRenderFunction = (vnode, container) => {
  while (container.firstChild) container.removeChild(container.firstChild)
  const el = renderVNode(vnode)
  hostInsert(el, container)
}
```

前のチャプターの時点で「これはヤバそうだ」と気づいた人ももしかしたらいるかもしれません。
この関数にはとんでもない無駄が存在します。

playground を見てみてください。

```ts
const app = createApp({
  setup() {
    const state = reactive({ count: 0 })
    const increment = () => state.count++

    return function render() {
      return h('div', { id: 'my-app' }, [
        h('p', {}, [`count: ${state.count}`]),
        h('button', { onClick: increment }, ['increment']),
      ])
    }
  },
})
```

何がまずいかというと、increment を実行した時に変化する部分は、`count: ${state.count}` の部分だけなのに、renderVNode では一度全ての DOM を削除し、1 から再生成しているのです。  
これはなんとも無駄だらけな感じがしてなりません。今はまだ小さいので、これくらいでも特に問題なく動いているように見えますが、普段 Web アプリケーションを開発しているときような複雑な DOM を毎度毎度丸ごと作り替えるととんでもなくパフォーマンスが落ちてしまうのが容易に想像できると思います。  
そこで、せっかく Virtual DOM を持っているわけですから、画面を描画する際に、前の Virtual DOM と比較して差分があったところだけを DOM 操作で書き換えるような実装をしたくなります。  
さて、今回のメインテーマはこれです。

やりたいことをソースコードベースで見てみましょう。
上記のようなコンポーネントがあったとき、render 関数の戻り値は以下のような Virtual DOM になっています。
初回のレンダリング時には count は 0 なので以下のようになります。

```ts
const vnode = {
  type: "div",
  props: { id: "my-app" },
  children: [
    {
      type: "p",
      props: {},
      children: [`count: 0`]
    },
    {
      type: "button",
      { onClick: increment },
      children: ["increment"]
    }
  ]
}
```

この vnode を持っておいて、次のレンダリングの時の vnode はまた別で持つことにしましょう。以下は 1 回目のボタンがクリックされた時の vnode です。

```ts
const nextVnode = {
  type: "div",
  props: { id: "my-app" },
  children: [
    {
      type: "p",
      props: {},
      children: [`count: 1`] // ここだけ更新したいなぁ〜
    },
    {
      type: "button",
      { onClick: increment },
      children: ["increment"]
    }
  ]
}
```

今、vnode と、nextVnode の 2 つを持っている状態で、画面は vnode の状態です(nextVnode になる前)
これら二つを patch という関数に渡してあげて、差分だけレンダリングするようにしたいです。

```ts
const vnode = {...}
const nextVnode = {...}
patch(vnode, nextVnode, container)
```

先に関数名を紹介してしまいましたが、この差分レンダリングは「パッチ」と呼ばれます。差分検出処理 (reconciliation)と呼ばれることもあるようです。
このように 2 つの Virtual DOM を利用することで効率的に画面の更新を行うことができます。

## patch 関数の実装を行う前に

本筋とは関係ないのですが、ちょっとここらで軽いリファクタを行なっておきます。(今から話すことにとって都合がいいので)
vnode.ts に createVNode と言う関数を作っておいて、h 関数からはそれを呼ぶようにしておきましょう。

```ts
export function createVNode(
  type: VNodeTypes,
  props: VNodeProps | null,
  children: unknown,
): VNode {
  const vnode: VNode = { type, props, children }
  return vnode
}
```

h 関数も変更

```ts
export function h(
  type: string,
  props: VNodeProps,
  children: (VNode | string)[],
) {
  return createVNode(type, props, children)
}
```

ここからが本筋なのですが、これまで VNode が持つ子要素の型は`(Vnode | string)[]`としてきたのですが、Text を文字列として扱い続けるのもなんなので、VNode に統一してみようと思います。
Text も実際にはただの文字列ではなく、HTML の TextElement として存在するので、文字列以上の情報を含みます。それらの周辺情報を扱うためにも VNode として扱いたいわけです。
具体的には、Text と言う Symbol を用いて、VNode の type として持たせましょう。
例えば、`"hello"`のようなテキストがあった時、

```ts
{
  type: Text,
  props: null,
  children: "hello"
}
```

としてあげる感じです。

また、ここで一つ注意点なのは、h 関数を実行した時は従来通りの表現をして、上記のように Text を表現するのは、render 関数内で normalize と言う関数を噛ませて変換することにします。  
これは本家の Vue.js に合わせてそうすることにします。

`~/packages/runtime-core/vnode.ts`;

```ts
export const Text = Symbol();

export type VNodeTypes = string | typeof Text;

export interface VNode<HostNode = any> {
  type: VNodeTypes;
  props: VNodeProps | null;
  children: VNodeNormalizedChildren;
}

export interface VNodeProps {
  [key: string]: any;
}

// normalize後の型
export type VNodeNormalizedChildren = string | VNodeArrayChildren;
export type VNodeArrayChildren = Array<VNodeArrayChildren | VNodeChildAtom>;

export type VNodeChild = VNodeChildAtom | VNodeArrayChildren;
type VNodeChildAtom = VNode | string;

export function createVNode(..){..} // 省略

// normalize 関数を実装。(renderer.tsで使う)
export function normalizeVNode(child: VNodeChild): VNode {
  if (typeof child === "object") {
    return { ...child } as VNode;
  } else {
    // stringだった場合に先ほど紹介した扱いたい形に変換する
    return createVNode(Text, null, String(child));
  }
}
```

これで Text も VNode として扱えるようになりました。

## patch 関数の設計

まず、patch 関数の設計をコードベースで見てみましょう。(実装フェーズはまた別であるのでここではまだ実装しなくていいです。理解だけ。)  
patch 関数でやりたいことは 2 つの vnode の比較なので、便宜上それぞれ vnode1, vnode2 とするのですが、初回は vnode1 がありません。  
つまり、patch 関数での処理は「初回(vnode2 から dom を生成)」と、「vnode1 と vnode2 の差分を更新」の処理に分かれます。  
これらの処理をそれぞれ「mount」と「patch」と名付けることにします。  
そしてそれらは ElementNode と TextNode それぞれで行うようにします。(それぞれの mount と patch を process と言う名前でまとめてます。)

```ts
const patch = (
  n1: VNode | string | null,
  n2: VNode | string,
  container: HostElement,
) => {
  const { type } = n2
  if (type === Text) {
    processText(n1, n2, container)
  } else {
    processElement(n1, n2, container)
  }
}

const processElement = (
  n1: VNode | null,
  n2: VNode,
  container: HostElement,
) => {
  if (n1 === null) {
    mountElement(n2, container)
  } else {
    patchElement(n1, n2)
  }
}

const processText = (n1: string | null, n2: string, container: HostElement) => {
  if (n1 === null) {
    mountText(n2, container)
  } else {
    patchText(n1, n2)
  }
}
```

## 実際に実装してみる

ここから実際に Virtual DOM の patch を実装していきます。  
まず、Element にしろ、Text にしろ、マウントした段階で vnode に実際の DOM への参照を持たせておきたいので、vnode の el というプロパティを持たせておきます。

`~/packages/runtime-core/vnode.ts`

```ts
export interface VNode<HostNode = RendererNode> {
  type: VNodeTypes
  props: VNodeProps | null
  children: VNodeNormalizedChildren
  el: HostNode | undefined // [!code ++]
}
```

それではここからは`~/packages/runtime-core/renderer.ts`です。  
createRenderer 関数の中に実装していきましょう。
renderVNode 関数は消してしまいます。

```ts
export function createRenderer(options: RendererOptions) {
  // .
  // .
  // .

  const patch = (n1: VNode | null, n2: VNode, container: RendererElement) => {
    const { type } = n2
    if (type === Text) {
      // processText(n1, n2, container);
    } else {
      // processElement(n1, n2, container);
    }
  }
}
```

processElement の mountElement から実装していきます。

```ts
const processElement = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
) => {
  if (n1 === null) {
    mountElement(n2, container)
  } else {
    // patchElement(n1, n2);
  }
}

const mountElement = (vnode: VNode, container: RendererElement) => {
  let el: RendererElement
  const { type, props } = vnode
  el = vnode.el = hostCreateElement(type as string)

  mountChildren(vnode.children, el) // TODO:

  if (props) {
    for (const key in props) {
      hostPatchProp(el, key, props[key])
    }
  }

  hostInsert(el, container)
}
```

要素なので、当然子要素のマウントも必要です。
ここで、先ほど作った normalize 関数を噛ませておきましょう。

```ts
const mountChildren = (children: VNode[], container: RendererElement) => {
  for (let i = 0; i < children.length; i++) {
    const child = (children[i] = normalizeVNode(children[i]))
    patch(null, child, container)
  }
}
```

ここまでで要素のマウントは実装できました。  
次は Text のマウントからやりましょう。と、言ってもこちらはただ DOM 操作をするだけです。  
設計の説明では mountText と patchText のように関数に分けてましたが、たいした処理もなく、今後もそれほど複雑にならないはずなので直接書いてしまいます。

```ts
const processText = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
) => {
  if (n1 == null) {
    hostInsert((n2.el = hostCreateText(n2.children as string)), container)
  } else {
    // TODO: patch
  }
}
```

一旦ここまでで、初回のマウントはできるようになったはずなので、render 関数で patch 関数を使用して playground で試してみましょう!  
今まで、createAppAPI の mount に書いていた処理を一部 render 関数に移植して、２つの vnode を保持できるようにします。  
具体的には。render 関数に rootComponent を渡して、その中で ReactiveEffect の登録等を行うように変更します。

```ts
return function createApp(rootComponent) {
  const app: App = {
    mount(rootContainer: HostElement) {
      // rootComponentを渡すだけに
      render(rootComponent, rootContainer)
    },
  }
}
```

```ts
const render: RootRenderFunction = (rootComponent, container) => {
  const componentRender = rootComponent.setup!()

  let n1: VNode | null = null

  const updateComponent = () => {
    const n2 = componentRender()
    patch(n1, n2, container)
    n1 = n2
  }

  const effect = new ReactiveEffect(updateComponent)
  effect.run()
}
```

ここまでできたら playground で描画できるかどうか試してみましょう！

まだ、patch の処理は行なっていないので画面の更新は行われません。

と、言うことで引き続き patch の処理を書いていきましょう。

```ts
const patchElement = (n1: VNode, n2: VNode) => {
  const el = (n2.el = n1.el!)

  const props = n2.props

  patchChildren(n1, n2, el)

  for (const key in props) {
    if (props[key] !== n1.props?.[key] ?? {}) {
      hostPatchProp(el, key, props[key])
    }
  }
}

const patchChildren = (n1: VNode, n2: VNode, container: RendererElement) => {
  const c1 = n1.children as VNode[]
  const c2 = n2.children as VNode[]

  for (let i = 0; i < c2.length; i++) {
    const child = (c2[i] = normalizeVNode(c2[i]))
    patch(c1[i], child, container)
  }
}
```

Text も同様に。

```ts
const processText = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
) => {
  if (n1 == null) {
    hostInsert((n2.el = hostCreateText(n2.children as string)), container)
  } else {
    // patchの処理を追加
    const el = (n2.el = n1.el!)
    if (n2.children !== n1.children) {
      hostSetText(el, n2.children as string)
    }
  }
}
```

※ patchChildren に関して、本来は key 属性などを付与して動的な長さの子要素に対応したりしないといけないのですが、今回は小さく Virtual DOM を実装するのでその辺の実用性については触れません。  
そのあたりをやりたい方は Basic Virtual DOM 部門で説明するのでぜひそちらをご覧ください。ここでは Virtual DOM の実装雰囲気であったり、役割が理解できるところまでの理解を目指します。

さて、これで差分レンダリングができるようになったので、playground を見てみましょう。

![patch_rendering](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/patch_rendering.png)

これで Virtual DOM を利用したパッチが実装できました!!!!! 祝

ここまでのソースコード: [GitHub](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/10_minimum_example/040_vdom_system)
