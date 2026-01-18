# Vapor Mode

## Vapor Mode とは

Vapor Mode は Vue.js の新しいコンパイル戦略で，仮想 DOM を使用せずに直接 DOM 操作を行うことでパフォーマンスを向上させるアプローチです．

従来の Vue.js では，コンポーネントの状態が変更されると，仮想 DOM を再生成し，差分検出（diffing）を行い，実際の DOM に反映するという流れでした．Vapor Mode では，この仮想 DOM のオーバーヘッドを排除し，リアクティブな値の変更時に必要な DOM 操作のみを直接実行します．

## 詳細なリソース

Vapor Mode の詳細な解説については，以下のリポジトリを参照してください：

**[reading-vuejs-core-vapor](https://github.com/ubugeeei/reading-vuejs-core-vapor)**

このリポジトリでは，Vue.js の Vapor Mode の内部実装について詳しく解説しています．

## chibivue での Vapor 実装

chibivue では，`runtime-vapor` パッケージで最小限の Vapor 実装を提供しています．
ここでは，その基本的なコンセプトを理解するための簡単な実装を見ていきましょう．

### 基本的なアイデア

Vapor Mode の核心は以下の 2 点です：

1. **テンプレートを DOM に直接変換する**: 仮想 DOM ノードではなく，実際の DOM 要素を生成する
2. **リアクティブな値の変更を直接 DOM に反映する**: 差分検出なしに，変更された部分だけを更新する

### template 関数

まず，HTML 文字列から DOM 要素を作成する `template` 関数を見てみましょう：

```ts
export type VaporNode = Element & { __is_vapor: true };

export const template = (tmp: string): VaporNode => {
  const container = document.createElement("div");
  container.innerHTML = tmp;
  const el = container.firstElementChild as VaporNode;
  el.__is_vapor = true;
  return el;
};
```

この関数は，HTML 文字列を受け取り，実際の DOM 要素を返します．仮想 DOM を介さず，直接 DOM を操作します．

### setText 関数

テキストコンテンツを更新する `setText` 関数です：

```ts
export const setText = (
  target: Element,
  format: string,
  ...values: any[]
): void => {
  const fmt = (): string => {
    let text = format;
    for (let i = 0; i < values.length; i++) {
      text = text.replace("{}", values[i]);
    }
    return text;
  };

  if (!target) return;

  if (!values.length) {
    target.textContent = fmt();
    return;
  }

  if (!format && values.length) {
    target.textContent = values.join("");
    return;
  }

  target.textContent = fmt();
};
```

この関数は，リアクティブな値が変更されたときに呼び出され，DOM のテキストコンテンツを直接更新します．

### on 関数

イベントリスナーを登録する `on` 関数です：

```ts
export const on = (
  element: Element,
  event: string,
  callback: () => void
): void => {
  element.addEventListener(event, callback);
};
```

### Vapor コンポーネント

Vapor Mode でのコンポーネントは，通常の Vue コンポーネントとは異なる形式を取ります：

```ts
export type VaporComponent = (self: VaporComponentInternalInstance) => VaporNode;

export interface VaporComponentInternalInstance {
  __is_vapor: true;
  uid: number;
  type: VaporComponent;
  parent: ComponentInternalInstance | VaporComponentInternalInstance | null;
  appContext: AppContext;
  provides: Data;
  isMounted: boolean;
  // ライフサイクルフック
  [LifecycleHooks.BEFORE_MOUNT]: LifecycleHook;
  [LifecycleHooks.MOUNTED]: LifecycleHook;
  // ...
}
```

Vapor コンポーネントは，インスタンスを受け取って VaporNode（実際の DOM 要素）を返す関数です．

### コンパイル結果の比較

従来の仮想 DOM ベースのコンパイル結果：

```ts
// 入力: <div>{{ count }}</div>
// 仮想 DOM 出力
function render(_ctx) {
  return h("div", null, _ctx.count);
}
```

Vapor Mode のコンパイル結果：

```ts
// 入力: <div>{{ count }}</div>
// Vapor 出力
const t0 = template("<div></div>");

function render(_ctx) {
  const el = t0();
  effect(() => {
    setText(el, _ctx.count);
  });
  return el;
}
```

Vapor Mode では：
- テンプレートは事前に DOM 要素として生成される（`template` 関数）
- リアクティブな値の更新は `effect` 内で直接 DOM を操作する
- 仮想 DOM の生成と差分検出のコストがない

## まとめ

Vapor Mode は，仮想 DOM のオーバーヘッドを排除することで，パフォーマンスを向上させる新しいアプローチです．chibivue の `runtime-vapor` パッケージでは，この概念の最小限の実装を提供しています．

より詳細な実装や，Vue.js 本家の Vapor Mode については，[reading-vuejs-core-vapor](https://github.com/ubugeeei/reading-vuejs-core-vapor) を参照してください．
