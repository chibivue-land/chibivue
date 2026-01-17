# defineProps に対応する

::: info この章について
この章では，`<script setup>` で使用する `defineProps` マクロの実装方法を学びます。\
コンパイラマクロの仕組みと，props の宣言がどのように処理されるかを理解しましょう。
:::

## defineProps とは

`defineProps` は `<script setup>` 内でコンポーネントの props を宣言するためのコンパイラマクロです。

```vue
<script setup>
// ランタイム宣言
const props = defineProps({
  title: String,
  count: {
    type: Number,
    default: 0
  }
})

console.log(props.title)
</script>
```

<KawaikoNote variant="question" title="コンパイラマクロって？">

`defineProps` は通常の関数ではありません。**コンパイラマクロ**です。\
コンパイル時に特別な処理が行われ，実行時には消去されます。\
そのため，import なしで使えるんです！

</KawaikoNote>

## 実装の概要

defineProps の処理は以下のステップで行われます：

1. **マクロ呼び出しの検出**: AST から `defineProps()` の呼び出しを見つける
2. **引数の抽出**: props の定義オブジェクトを取得
3. **コードの削除**: 元の `defineProps()` 呼び出しを削除
4. **オプションへの追加**: `props` オプションとして出力に追加
5. **バインディングの登録**: props を `PROPS` タイプとして登録

## processDefineProps 関数

```ts
// packages/compiler-sfc/src/compileScript.ts

const DEFINE_PROPS = "defineProps"

let propsRuntimeDecl: Node | undefined
let propsIdentifier: string | undefined

function processDefineProps(node: Node, declId?: LVal): boolean {
  if (!isCallOf(node, DEFINE_PROPS)) {
    return false
  }

  // 引数（props定義オブジェクト）を保存
  propsRuntimeDecl = node.arguments[0]

  // 変数に代入されている場合は識別子を保存
  // const props = defineProps(...) の "props" 部分
  if (declId) {
    propsIdentifier = scriptSetup!.content.slice(declId.start!, declId.end!)
  }

  return true
}
```

## AST の走査

`<script setup>` の本文を走査して `defineProps` を検出します。

```ts
// 2.2 process <script setup> body
for (const node of scriptSetupAst.body) {
  // 式文の場合（defineProps() 単体で呼び出された場合）
  if (node.type === "ExpressionStatement") {
    const expr = node.expression
    if (processDefineProps(expr)) {
      // マクロ呼び出しを削除
      s.remove(node.start! + startOffset, node.end! + startOffset)
    }
  }

  // 変数宣言の場合（const props = defineProps(...)）
  if (node.type === "VariableDeclaration" && !node.declare) {
    for (let i = 0; i < node.declarations.length; i++) {
      const decl = node.declarations[i]
      const init = decl.init
      if (init) {
        const declId = decl.id.type === "VoidPattern" ? undefined : decl.id
        if (processDefineProps(init, declId)) {
          // 宣言を削除
          s.remove(node.start! + startOffset, node.end! + startOffset)
        }
      }
    }
  }
}
```

## props バインディングの登録

props として宣言された変数は，テンプレートから参照できるようにバインディングメタデータに登録します。

```ts
// 7. analyze binding metadata
if (propsRuntimeDecl) {
  for (const key of getObjectExpressionKeys(propsRuntimeDecl as ObjectExpression)) {
    bindingMetadata[key] = BindingTypes.PROPS
  }
}
```

`BindingTypes.PROPS` として登録することで，テンプレートコンパイラは props へのアクセスを正しく処理できます。

## props 識別子の処理

`const props = defineProps(...)` のように変数に代入された場合，その変数で props にアクセスできるようにします。

```ts
// 9. finalize setup() argument signature
let args = `__props`
if (propsIdentifier) {
  // const props = __props; を追加
  s.prependLeft(startOffset, `\nconst ${propsIdentifier} = __props;\n`)
}
```

## オプションへの追加

最終的に，props 定義はコンポーネントオプションとして出力されます。

```ts
// 11. finalize default export
let runtimeOptions = ``
if (propsRuntimeDecl) {
  let declCode = scriptSetup.content
    .slice(propsRuntimeDecl.start!, propsRuntimeDecl.end!)
    .trim()
  runtimeOptions += `\n  props: ${declCode},`
}

s.prependLeft(
  startOffset,
  `\nexport default {\n${runtimeOptions}\nsetup(${args}) {\n`
)
```

## 変換結果の例

```vue
<!-- 入力 -->
<script setup>
const props = defineProps({
  title: String,
  count: Number
})
</script>

<template>
  <h1>{{ title }}</h1>
</template>
```

```ts
// 出力
export default {
  props: {
    title: String,
    count: Number
  },
  setup(__props) {
    const props = __props;

    return (_ctx) => {
      return h('h1', _ctx.title)
    }
  }
}
```

<KawaikoNote variant="funny" title="シンプル！">

`defineProps` は複雑そうに見えますが，やっていることはシンプル：
1. 引数を `props` オプションに移動
2. `defineProps()` 呼び出しを削除
3. 変数があれば `__props` への参照に置き換え

</KawaikoNote>

## 動作確認

```vue
<script setup>
import { computed } from 'chibivue'

const props = defineProps({
  firstName: String,
  lastName: String
})

const fullName = computed(() => `${props.firstName} ${props.lastName}`)
</script>

<template>
  <div>
    <p>First: {{ firstName }}</p>
    <p>Last: {{ lastName }}</p>
    <p>Full: {{ fullName }}</p>
  </div>
</template>
```

親コンポーネント：

```vue
<script setup>
import ChildComponent from './ChildComponent.vue'
</script>

<template>
  <ChildComponent firstName="John" lastName="Doe" />
</template>
```

<KawaikoNote variant="base" title="実装完了！">

defineProps の実装が完了しました！\
コンパイラマクロの基本的な仕組みを理解できましたね。\
次の章では `defineEmits` マクロの実装を学びます。

</KawaikoNote>

## まとめ

- `defineProps` はコンパイラマクロで，コンパイル時に処理される
- AST を走査して `defineProps()` 呼び出しを検出
- 引数は `props` オプションに変換され，呼び出し自体は削除
- props は `BindingTypes.PROPS` として登録され，テンプレートから参照可能

## 参考リンク

- [Vue.js - defineProps](https://vuejs.org/api/sfc-script-setup.html#defineprops-defineemits) - Vue 公式ドキュメント
