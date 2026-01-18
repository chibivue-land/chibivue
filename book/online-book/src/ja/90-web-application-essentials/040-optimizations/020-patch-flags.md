# Patch Flags

## Patch Flags とは

Patch Flags は，コンパイラが生成する最適化ヒントです．VNode にフラグを付与することで，ランタイムの差分検出（diffing）アルゴリズムが不要なチェックをスキップし，パフォーマンスを向上させます．

<KawaikoNote variant="question" title="なぜコンパイラが最適化？">

テンプレートを書く人間は「ここは動的」「ここは静的」と把握していますが，
従来の Virtual DOM はそれを知りません．コンパイラがその情報をランタイムに伝えることで，
無駄な比較を省けるようになります！

</KawaikoNote>

### 最適化の仕組み

通常の Virtual DOM の差分検出では，すべてのプロパティと子要素を比較する必要があります．しかし，コンパイラはテンプレートを解析する段階で「どの部分が動的か」を知っています．この情報を Patch Flags として VNode に埋め込むことで，ランタイムは変更される可能性のある部分だけをチェックできます．

## PatchFlags の定義

```ts
export const enum PatchFlags {
  /**
   * 動的な textContent を持つ要素
   */
  TEXT = 1,

  /**
   * 動的な class バインディングを持つ要素
   */
  CLASS = 1 << 1,  // 2

  /**
   * 動的な style を持つ要素
   */
  STYLE = 1 << 2,  // 4

  /**
   * class/style 以外の動的な props を持つ要素
   */
  PROPS = 1 << 3,  // 8

  /**
   * 動的なキーを持つ props がある要素
   */
  FULL_PROPS = 1 << 4,  // 16

  /**
   * hydration 時に props の処理が必要
   */
  NEED_HYDRATION = 1 << 5,  // 32

  /**
   * 子の順序が変わらない Fragment
   */
  STABLE_FRAGMENT = 1 << 6,  // 64

  /**
   * keyed な子を持つ Fragment
   */
  KEYED_FRAGMENT = 1 << 7,  // 128

  /**
   * keyed でない子を持つ Fragment
   */
  UNKEYED_FRAGMENT = 1 << 8,  // 256

  /**
   * props 以外のパッチが必要（ref、ディレクティブなど）
   */
  NEED_PATCH = 1 << 9,  // 512

  /**
   * 動的なスロットを持つコンポーネント
   */
  DYNAMIC_SLOTS = 1 << 10,  // 1024

  /**
   * 開発用：ルートにコメントがある Fragment
   */
  DEV_ROOT_FRAGMENT = 1 << 11,  // 2048

  // 特殊フラグ（負の整数）

  /**
   * キャッシュされた静的 VNode
   */
  CACHED = -1,

  /**
   * 最適化モードを終了するヒント
   */
  BAIL = -2,
}
```

## ビット演算による組み合わせ

Patch Flags はビットフラグとして設計されており，複数のフラグを組み合わせることができます．

```ts
// フラグの組み合わせ
const flag = PatchFlags.TEXT | PatchFlags.CLASS;  // 3 (0b11)

// フラグのチェック
if (flag & PatchFlags.TEXT) {
  // TEXT フラグが設定されている
}

if (flag & PatchFlags.CLASS) {
  // CLASS フラグが設定されている
}
```

<KawaikoNote variant="funny" title="ビット演算の魔法">

`1 << 1` は `2`，`1 << 2` は `4`...ビットをずらすだけで独立したフラグが作れます．
`|`（OR）で組み合わせ，`&`（AND）でチェック．シンプルだけど超効率的！

</KawaikoNote>

## テンプレートからの生成例

### 動的テキスト

```vue
<template>
  <p>{{ message }}</p>
</template>
```

生成コード：
```js
// patchFlag = 1 (TEXT)
createVNode("p", null, toDisplayString(message), 1 /* TEXT */)
```

### 動的クラス

```vue
<template>
  <div :class="dynamicClass">Content</div>
</template>
```

生成コード：
```js
// patchFlag = 2 (CLASS)
createVNode("div", { class: dynamicClass }, "Content", 2 /* CLASS */)
```

### 複数の動的プロパティ

```vue
<template>
  <div :class="cls" :style="styles">{{ text }}</div>
</template>
```

生成コード：
```js
// patchFlag = 7 (TEXT | CLASS | STYLE)
createVNode("div",
  { class: cls, style: styles },
  toDisplayString(text),
  7 /* TEXT, CLASS, STYLE */
)
```

### 動的 props

```vue
<template>
  <input :value="inputValue" :disabled="isDisabled">
</template>
```

生成コード：
```js
// patchFlag = 8 (PROPS)
// dynamicProps で変更される可能性のある props を明示
createVNode("input",
  { value: inputValue, disabled: isDisabled },
  null,
  8 /* PROPS */,
  ["value", "disabled"]
)
```

## ランタイムでの活用

### patchElement での最適化

```ts
function patchElement(n1: VNode, n2: VNode) {
  const el = n2.el = n1.el;
  const { patchFlag, dynamicProps } = n2;

  if (patchFlag > 0) {
    // 最適化パス：フラグに基づいて必要な部分だけ更新

    if (patchFlag & PatchFlags.CLASS) {
      // class のみ更新
      if (n1.props?.class !== n2.props?.class) {
        hostSetClass(el, n2.props?.class);
      }
    }

    if (patchFlag & PatchFlags.STYLE) {
      // style のみ更新
      hostPatchStyle(el, n1.props?.style, n2.props?.style);
    }

    if (patchFlag & PatchFlags.PROPS) {
      // 指定された props のみ更新
      for (const key of dynamicProps!) {
        const prev = n1.props?.[key];
        const next = n2.props?.[key];
        if (prev !== next) {
          hostPatchProp(el, key, prev, next);
        }
      }
    }

    if (patchFlag & PatchFlags.TEXT) {
      // テキストコンテンツのみ更新
      if (n1.children !== n2.children) {
        hostSetElementText(el, n2.children as string);
      }
    }
  } else if (patchFlag === PatchFlags.FULL_PROPS) {
    // すべての props をチェック
    patchProps(el, n1.props, n2.props);
  } else {
    // フラグなし：フルの diff
    patchProps(el, n1.props, n2.props);
    patchChildren(n1, n2, el);
  }
}
```

### Fragment の最適化

```ts
function patchFragment(n1: VNode, n2: VNode) {
  const { patchFlag } = n2;

  if (patchFlag & PatchFlags.STABLE_FRAGMENT) {
    // 子の順序が変わらない：シンプルな更新
    patchBlockChildren(n1.children, n2.children);
  } else if (patchFlag & PatchFlags.KEYED_FRAGMENT) {
    // keyed children：キーベースの diff
    patchKeyedChildren(n1.children, n2.children);
  } else {
    // unkeyed：フルの diff
    patchUnkeyedChildren(n1.children, n2.children);
  }
}
```

## 特殊フラグ

### CACHED (-1)

静的な VNode がキャッシュされていることを示します．

```js
const _hoisted_1 = createVNode("div", null, "Static", -1 /* CACHED */);
```

キャッシュされた VNode は差分検出をスキップできます．

### BAIL (-2)

最適化モードを終了するヒントです．ユーザーが手書きの render 関数を使用している場合など，コンパイラの最適化が適用できない場合に使用されます．

## dynamicProps

`patchFlag` と一緒に使用される `dynamicProps` 配列は，どの props が動的かを明示します．

```ts
// 動的な props が value と disabled
createVNode("input",
  { type: "text", value: val, disabled: isDisabled },
  null,
  8 /* PROPS */,
  ["value", "disabled"]  // dynamicProps
)
```

これにより，`type` は静的なので比較をスキップし，`value` と `disabled` のみをチェックできます．

## Block Tree との連携

Patch Flags は Block Tree 最適化と連携して動作します．Block は `dynamicChildren` 配列を持ち，動的な子ノードのみを追跡します．

```ts
const block = openBlock();
const vnode = createBlock("div", null, [
  createVNode("p", null, "static"),  // dynamicChildren に含まれない
  createVNode("p", null, toDisplayString(msg), 1 /* TEXT */)  // 含まれる
]);
// block.dynamicChildren = [動的な p のみ]
```

Block の更新時は `dynamicChildren` のみを走査すれば良いため，静的な子ノードの比較をスキップできます．

## 最適化の効果

### Before（フラグなし）
```
すべての props を比較: O(n)
すべての子を比較: O(m)
合計: O(n + m)
```

### After（フラグあり）
```
動的な props のみ比較: O(k) where k << n
動的な子のみ比較: O(l) where l << m
合計: O(k + l)
```

テンプレートの大部分が静的な場合，この最適化は大きな効果を発揮します．

## まとめ

Patch Flags の実装は以下の要素で構成されています：

1. **ビットフラグ**: 複数の動的要素を効率的に表現
2. **コンパイラ統合**: テンプレート解析時に自動生成
3. **ランタイム最適化**: フラグに基づいて不要な比較をスキップ
4. **dynamicProps**: 動的な props を明示的に追跡
5. **Block Tree 連携**: 動的な子ノードのみを効率的に更新

Patch Flags は Vue 3 の Virtual DOM パフォーマンスを大幅に向上させる重要な最適化技術です．コンパイラとランタイムが協調することで，テンプレートベースのフレームワークの利点を最大限に活かしています．

<KawaikoNote variant="surprise" title="Patch Flags 完成！">

「テンプレートを解析できるなら，最適化のヒントも出せるよね」という発想から生まれた技術です．
JSX にはない，テンプレートコンパイラならではの強みをぜひ体感してください！

</KawaikoNote>

ここまでのソースコード:
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/90_web_application_essentials/050_patch_flags)
