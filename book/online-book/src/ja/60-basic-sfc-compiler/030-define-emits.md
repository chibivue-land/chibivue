# defineEmits に対応する

::: info この章について
この章では，`<script setup>` で使用する `defineEmits` マクロの実装方法を学びます。\
子コンポーネントから親コンポーネントへのイベント発行の仕組みを理解しましょう。
:::

## defineEmits とは

`defineEmits` は `<script setup>` 内でコンポーネントが発行するイベントを宣言するためのコンパイラマクロです。

```vue
<script setup>
const emit = defineEmits(['change', 'update'])

function handleClick() {
  emit('change', 'new value')
}
</script>
```

<KawaikoNote variant="question" title="defineProps との違いは？">

`defineProps` は親から子へのデータの流れ（Props Down）、\
`defineEmits` は子から親へのイベントの流れ（Events Up）を担当します。\
Vue の双方向データフローの両輪ですね！

</KawaikoNote>

## 実装の概要

defineEmits の処理は defineProps と非常に似ています：

1. **マクロ呼び出しの検出**: AST から `defineEmits()` の呼び出しを見つける
2. **引数の抽出**: イベント定義の配列またはオブジェクトを取得
3. **コードの削除**: 元の `defineEmits()` 呼び出しを削除
4. **オプションへの追加**: `emits` オプションとして出力に追加
5. **emit 関数の提供**: setup のコンテキストから `emit` を取得

## processDefineEmits 関数

```ts
// packages/compiler-sfc/src/compileScript.ts

const DEFINE_EMITS = "defineEmits"

let emitsRuntimeDecl: Node | undefined
let emitIdentifier: string | undefined

function processDefineEmits(node: Node, declId?: LVal): boolean {
  if (!isCallOf(node, DEFINE_EMITS)) {
    return false
  }

  // イベント定義を保存
  emitsRuntimeDecl = node.arguments[0]

  // 変数に代入されている場合は識別子を保存
  // const emit = defineEmits(...) の "emit" 部分
  if (declId) {
    emitIdentifier =
      declId.type === "Identifier"
        ? declId.name
        : scriptSetup!.content.slice(declId.start!, declId.end!)
  }

  return true
}
```

## AST の走査

defineProps と同様に，`<script setup>` の本文を走査して `defineEmits` を検出します。

```ts
// 2.2 process <script setup> body
for (const node of scriptSetupAst.body) {
  if (node.type === "ExpressionStatement") {
    const expr = node.expression
    if (processDefineProps(expr) || processDefineEmits(expr)) {
      s.remove(node.start! + startOffset, node.end! + startOffset)
    }
  }

  if (node.type === "VariableDeclaration" && !node.declare) {
    for (let i = 0; i < node.declarations.length; i++) {
      const decl = node.declarations[i]
      const init = decl.init
      if (init) {
        const declId = decl.id.type === "VoidPattern" ? undefined : decl.id
        const isDefineProps = processDefineProps(init, declId)
        const isDefineEmits = processDefineEmits(init, declId)
        if (isDefineProps || isDefineEmits) {
          s.remove(node.start! + startOffset, node.end! + startOffset)
        }
      }
    }
  }
}
```

## emit 関数のセットアップ

`defineEmits` で取得した emit 関数は，setup 関数の第2引数（SetupContext）から取得します。

```ts
// 9. finalize setup() argument signature
let args = `__props`

const destructureElements: string[] = []
if (emitIdentifier) {
  destructureElements.push(
    emitIdentifier === `emit` ? `emit` : `emit: ${emitIdentifier}`
  )
}

if (destructureElements.length) {
  args += `, { ${destructureElements.join(", ")} }`
}
```

これにより，以下のようなコードが生成されます：

```ts
// const emit = defineEmits(['change']) の場合
setup(__props, { emit }) {
  // ...
}

// const emitFn = defineEmits(['change']) の場合
setup(__props, { emit: emitFn }) {
  // ...
}
```

## オプションへの追加

```ts
// 11. finalize default export
let runtimeOptions = ``
if (propsRuntimeDecl) {
  runtimeOptions += `\n  props: ${...},`
}
if (emitsRuntimeDecl) {
  runtimeOptions += `\n  emits: ${scriptSetup.content
    .slice(emitsRuntimeDecl.start!, emitsRuntimeDecl.end!)
    .trim()},`
}
```

## 変換結果の例

```vue
<!-- 入力 -->
<script setup>
const emit = defineEmits(['update', 'delete'])

function handleUpdate(value) {
  emit('update', value)
}
</script>

<template>
  <button @click="handleUpdate('new')">Update</button>
</template>
```

```ts
// 出力
export default {
  emits: ['update', 'delete'],
  setup(__props, { emit }) {
    function handleUpdate(value) {
      emit('update', value)
    }

    return (_ctx) => {
      return h('button', { onClick: _ctx.handleUpdate.bind(_ctx, 'new') }, 'Update')
    }
  }
}
```

<KawaikoNote variant="funny" title="defineProps と対称的！">

`defineEmits` の実装は `defineProps` とほぼ同じパターン：
1. マクロ呼び出しを検出
2. 引数を `emits` オプションに移動
3. 変数があれば SetupContext から取得するよう変換

覚えやすいですね！

</KawaikoNote>

## 動作確認

子コンポーネント：

```vue
<script setup>
const props = defineProps({
  modelValue: String
})

const emit = defineEmits(['update:modelValue'])

function updateValue(e) {
  emit('update:modelValue', e.target.value)
}
</script>

<template>
  <input :value="modelValue" @input="updateValue" />
</template>
```

親コンポーネント：

```vue
<script setup>
import { ref } from 'chibivue'
import CustomInput from './CustomInput.vue'

const text = ref('')
</script>

<template>
  <CustomInput v-model="text" />
  <p>入力値: {{ text }}</p>
</template>
```

<KawaikoNote variant="base" title="実装完了！">

defineEmits の実装が完了しました！\
これで props と emits の両方のコンパイラマクロが使えるようになりました。\
次の章では scoped CSS の実装を学びます。

</KawaikoNote>

ここまでのソースコード:
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/60_basic_sfc_compiler/030_define_emits)

## まとめ

- `defineEmits` は子から親へのイベント発行を宣言するマクロ
- 処理パターンは `defineProps` と非常に類似
- emit 関数は SetupContext から destructure して取得
- `emits` オプションとしてコンポーネントに追加

## 参考リンク

- [Vue.js - defineEmits](https://vuejs.org/api/sfc-script-setup.html#defineprops-defineemits) - Vue 公式ドキュメント
