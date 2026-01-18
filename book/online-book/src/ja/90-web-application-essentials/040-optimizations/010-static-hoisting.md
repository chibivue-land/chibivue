# Static Hoisting（静的巻き上げ）

## Static Hoisting とは

Static Hoisting は，テンプレートコンパイル時の最適化テクニックの一つです．テンプレート内の静的な（リアクティブな依存関係を持たない）ノードを検出し，レンダー関数の外部に「巻き上げ」（hoist）することで，再レンダリング時のパフォーマンスを向上させます．

<KawaikoNote variant="question" title="なぜ巻き上げ（hoist）と呼ぶ？">

JavaScript の「変数の巻き上げ（hoisting）」と同じ発想です．
レンダー関数の中にある静的なコードを，関数の外に「持ち上げる」ことで，
関数が呼ばれるたびに再生成する必要がなくなります！

</KawaikoNote>

### 最適化の効果

1. **VNode 生成のスキップ**: 静的なノードは初回のみ生成され，再利用される
2. **メモリ使用量の削減**: 同一の VNode オブジェクトを再利用
3. **パッチ処理のスキップ**: 静的ノードは比較対象から除外可能

## 最適化前後の比較

### テンプレート

```vue
<template>
  <div>
    <h1>Hello World</h1>
    <p>{{ message }}</p>
  </div>
</template>
```

### 最適化なしのコンパイル結果

```js
function render() {
  return h('div', null, [
    h('h1', null, 'Hello World'),  // 毎回生成
    h('p', null, message.value)
  ])
}
```

### Static Hoisting 適用後

```js
const _hoisted_1 = h('h1', null, 'Hello World')  // 外部で一度だけ生成

function render() {
  return h('div', null, [
    _hoisted_1,  // 参照を再利用
    h('p', null, message.value)
  ])
}
```

<KawaikoNote variant="funny" title="劇的ビフォーアフター！">

毎回 VNode を生成していたのが，一度生成した VNode を使い回すだけに．
ヘッダーやフッターなど，変わらない部分が多いほど効果絶大です！

</KawaikoNote>

## 実装の概要

### ConstantTypes

ノードの静的性を表す列挙型です．

```ts
export const enum ConstantTypes {
  NOT_CONSTANT = 0,    // 動的（巻き上げ不可）
  CAN_SKIP_PATCH = 1,  // パッチ処理をスキップ可能
  CAN_HOIST = 2,       // 巻き上げ可能
  CAN_STRINGIFY = 3,   // 文字列化可能（さらに最適化可能）
}
```

### hoistStatic 関数

変換フェーズの後で呼び出され，静的ノードを検出して巻き上げます．

```ts
export function hoistStatic(root: RootNode, context: TransformContext): void {
  walk(root, context, new Map());
}
```

### walk 関数

AST を再帰的に走査し，巻き上げ可能なノードを検出します．

```ts
function walk(
  node: RootNode | TemplateChildNode,
  context: TransformContext,
  resultCache: Map<TemplateChildNode, ConstantTypes>,
): void {
  const { children } = node as RootNode | ElementNode;
  if (!children) return;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (
      child.type === NodeTypes.ELEMENT &&
      child.tagType === 0 // プレーン要素のみ対象
    ) {
      const constantType = getConstantType(child, context, resultCache);
      if (constantType > ConstantTypes.NOT_CONSTANT) {
        if (constantType >= ConstantTypes.CAN_HOIST) {
          // 巻き上げ可能
          const codegenNode = child.codegenNode as VNodeCall | undefined;
          if (codegenNode && codegenNode.type === NodeTypes.VNODE_CALL) {
            codegenNode.isStatic = true;
            context.hoists.push(codegenNode);
            // codegenNode を巻き上げ参照に置き換え
            child.codegenNode = context.hoist(codegenNode) as VNodeCall;
          }
        }
      } else {
        // 動的な場合は子を再帰的にチェック
        walk(child, context, resultCache);
      }
    }
  }
}
```

ポイント：
1. プレーン要素（コンポーネントではない）のみを対象
2. 静的なノードは `context.hoists` に追加
3. 元の `codegenNode` を `_hoisted_N` への参照に置き換え
4. 動的なノードは子ノードを再帰的にチェック

### getConstantType 関数

ノードが静的かどうかを判定します．

```ts
export function getConstantType(
  node: TemplateChildNode,
  context: TransformContext,
  resultCache: Map<TemplateChildNode, ConstantTypes>,
): ConstantTypes {
  // キャッシュをチェック
  const cached = resultCache.get(node);
  if (cached !== undefined) {
    return cached;
  }

  if (node.type === NodeTypes.ELEMENT) {
    // コンポーネントは巻き上げ不可
    if (node.tagType !== 0) {
      resultCache.set(node, ConstantTypes.NOT_CONSTANT);
      return ConstantTypes.NOT_CONSTANT;
    }

    const element = node as PlainElementNode;
    const codegenNode = element.codegenNode;

    if (!codegenNode || codegenNode.type !== NodeTypes.VNODE_CALL) {
      resultCache.set(node, ConstantTypes.NOT_CONSTANT);
      return ConstantTypes.NOT_CONSTANT;
    }

    // 動的な props がないかチェック
    if (codegenNode.props) {
      const propsType = codegenNode.props.type;
      if (propsType !== NodeTypes.JS_OBJECT_EXPRESSION) {
        resultCache.set(node, ConstantTypes.NOT_CONSTANT);
        return ConstantTypes.NOT_CONSTANT;
      }

      const properties = codegenNode.props.properties;
      for (let i = 0; i < properties.length; i++) {
        const { key, value } = properties[i];
        // キーと値が両方静的でなければ不可
        if (key.type !== NodeTypes.SIMPLE_EXPRESSION || !key.isStatic) {
          resultCache.set(node, ConstantTypes.NOT_CONSTANT);
          return ConstantTypes.NOT_CONSTANT;
        }
        if (value.type !== NodeTypes.SIMPLE_EXPRESSION || !value.isStatic) {
          resultCache.set(node, ConstantTypes.NOT_CONSTANT);
          return ConstantTypes.NOT_CONSTANT;
        }
      }
    }

    // 子要素も再帰的にチェック
    if (element.children) {
      for (let i = 0; i < element.children.length; i++) {
        const child = element.children[i];
        const childType = getConstantType(child, context, resultCache);
        if (childType === ConstantTypes.NOT_CONSTANT) {
          resultCache.set(node, ConstantTypes.NOT_CONSTANT);
          return ConstantTypes.NOT_CONSTANT;
        }
      }
    }

    // ディレクティブがあれば不可
    if (element.props && element.props.length > 0) {
      for (const prop of element.props) {
        if (prop.type === NodeTypes.DIRECTIVE) {
          resultCache.set(node, ConstantTypes.NOT_CONSTANT);
          return ConstantTypes.NOT_CONSTANT;
        }
      }
    }

    resultCache.set(node, ConstantTypes.CAN_HOIST);
    return ConstantTypes.CAN_HOIST;
  }

  // テキストノードは巻き上げ可能
  if (node.type === NodeTypes.TEXT) {
    resultCache.set(node, ConstantTypes.CAN_STRINGIFY);
    return ConstantTypes.CAN_STRINGIFY;
  }

  // 補間（{{ }}）は動的
  if (node.type === NodeTypes.INTERPOLATION) {
    resultCache.set(node, ConstantTypes.NOT_CONSTANT);
    return ConstantTypes.NOT_CONSTANT;
  }

  resultCache.set(node, ConstantTypes.NOT_CONSTANT);
  return ConstantTypes.NOT_CONSTANT;
}
```

判定ロジック：
1. **コンポーネント**: 常に動的（props や slots が変わる可能性）
2. **動的 props**: バインディング（`:class`，`:style` など）があれば動的
3. **ディレクティブ**: `v-if`，`v-for` などがあれば動的
4. **補間式**: `{{ message }}` は動的
5. **子要素**: 一つでも動的な子があれば親も動的
6. **静的テキスト/属性**: 巻き上げ可能

### コード生成

```ts
function genHoists(
  hoists: (TemplateChildNode | ExpressionNode)[],
  context: CodegenContext
) {
  const { push, newline } = context;
  for (let i = 0; i < hoists.length; i++) {
    const exp = hoists[i];
    if (exp) {
      push(`const _hoisted_${i + 1} = `);
      genNode(exp, context);
      newline();
    }
  }
}
```

`hoists` 配列に蓄積されたノードを，レンダー関数の前に定数として生成します．

### TransformContext の hoist メソッド

```ts
hoist(exp) {
  context.hoists.push(exp);
  const identifier = createSimpleExpression(
    `_hoisted_${context.hoists.length}`,
    false,
  );
  return identifier;
}
```

元のノードを `hoists` 配列に追加し，`_hoisted_N` という識別子を返します．これがレンダー関数内で参照されます．

## 巻き上げ可能な例

```vue
<template>
  <!-- ✅ 巻き上げ可能 -->
  <div class="static">Static content</div>
  <img src="/logo.png" alt="Logo">
  <p>Fixed text</p>

  <!-- ❌ 巻き上げ不可 -->
  <div :class="dynamicClass">Dynamic</div>
  <p>{{ message }}</p>
  <div v-if="show">Conditional</div>
  <MyComponent />
</template>
```

## transform フェーズでの呼び出し

```ts
export function transform(root: RootNode, options: TransformOptions): void {
  const context = createTransformContext(root, options);
  traverseNode(root, context);

  // hoistStatic オプションが有効な場合に実行
  if (options.hoistStatic) {
    hoistStatic(root, context);
  }

  createRootCodegen(root, context);
  root.components = [...context.components];
  root.helpers = new Set([...context.helpers.keys()]);
  root.hoists = context.hoists;
}
```

## オプション

```ts
export interface TransformOptions {
  hoistStatic?: boolean;  // 静的巻き上げを有効化
  // ...
}
```

## 生成されるコード例

入力テンプレート：
```vue
<template>
  <div>
    <header>
      <h1>My App</h1>
      <nav>
        <a href="/home">Home</a>
        <a href="/about">About</a>
      </nav>
    </header>
    <main>
      <p>{{ content }}</p>
    </main>
  </div>
</template>
```

生成コード：
```js
import { createVNode as _createVNode, toDisplayString as _toDisplayString } from 'vue'

// 静的ノードは外部に巻き上げ
const _hoisted_1 = _createVNode("header", null, [
  _createVNode("h1", null, "My App"),
  _createVNode("nav", null, [
    _createVNode("a", { href: "/home" }, "Home"),
    _createVNode("a", { href: "/about" }, "About")
  ])
])

function render(_ctx) {
  return _createVNode("div", null, [
    _hoisted_1,  // 参照を再利用
    _createVNode("main", null, [
      _createVNode("p", null, _toDisplayString(_ctx.content))  // 動的部分
    ])
  ])
}
```

## まとめ

Static Hoisting の実装は以下の要素で構成されています：

1. **ConstantTypes**: ノードの静的性レベルを表す列挙型
2. **getConstantType**: ノードが静的かどうかを判定
3. **walk**: AST を走査して巻き上げ可能なノードを検出
4. **hoist**: ノードを巻き上げ配列に追加し参照を返す
5. **genHoists**: 巻き上げられたノードをコード生成

この最適化により，大きなテンプレートで多くの静的コンテンツがある場合に，再レンダリングのパフォーマンスが大幅に向上します．特に，ヘッダー，フッター，サイドバーなど変更されない UI 部分で効果的です．

<KawaikoNote variant="surprise" title="Static Hoisting 完成！">

コンパイラが「この部分は変わらないな」と判断して自動的に最適化してくれます．
テンプレートベースのフレームワークならではの強みですね！

</KawaikoNote>

ここまでのソースコード:
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/90_web_application_essentials/040_static_hoisting)
