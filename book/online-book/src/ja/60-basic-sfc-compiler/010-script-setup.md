# script setup に対応する

::: info この章について
この章では，Vue 3 で導入された `<script setup>` 構文の実装方法を学びます。\
より簡潔にコンポーネントを記述できる script setup の仕組みを理解しましょう。
:::

## script setup とは

`<script setup>` は，Vue 3.2 で導入されたコンパイル時のシンタックスシュガーです。従来の Options API や Composition API に比べて，より簡潔にコンポーネントを記述できます。

```vue
<!-- 従来の書き方 -->
<script>
import { ref } from 'chibivue'
import MyComponent from './MyComponent.vue'

export default {
  components: { MyComponent },
  setup() {
    const count = ref(0)
    const increment = () => count.value++
    return { count, increment }
  }
}
</script>

<!-- script setup の書き方 -->
<script setup>
import { ref } from 'chibivue'
import MyComponent from './MyComponent.vue'

const count = ref(0)
const increment = () => count.value++
</script>
```

<KawaikoNote variant="surprise" title="こんなに短く！">

script setup を使うと，`export default` や `return` が不要になり，インポートしたコンポーネントも自動的に登録されます。\
コードがとてもスッキリしますね！

</KawaikoNote>

## 実装の概要

script setup のコンパイルは以下のステップで行われます：

1. **インポートの解析とホイスト**: import 文を抽出してファイルの先頭に移動
2. **バインディングの解析**: 変数宣言や関数定義を追跡
3. **マクロの処理**: defineProps, defineEmits などの処理（次章以降）
4. **コード変換**: setup 関数への変換と return 文の生成

## compileScript 関数

`compileScript` 関数は，SFC のスクリプト部分をコンパイルする中心的な関数です。

```ts
// packages/compiler-sfc/src/compileScript.ts

export function compileScript(
  sfc: SFCDescriptor,
  options: SFCScriptCompileOptions,
): SFCScriptBlock {
  let { script, scriptSetup, source } = sfc

  // Babel でパース
  const scriptAst = _parse(script?.content ?? "", { sourceType: "module" }).program
  const scriptSetupAst = _parse(scriptSetup?.content ?? "", { sourceType: "module" }).program

  // script setup がない場合は従来の処理
  if (!scriptSetup) {
    if (!script) {
      throw new Error(`SFC contains no <script> tags.`)
    }
    return { ...script, bindings: analyzeScriptBindings(scriptAst.body) }
  }

  // メタデータの初期化
  const bindingMetadata: BindingMetadata = {}
  const userImports: Record<string, ImportBinding> = Object.create(null)
  const setupBindings: Record<string, BindingTypes> = Object.create(null)

  const s = new MagicString(source)
  // ... 変換処理
}
```

## インポートのホイスト

script setup 内のインポート文は，生成されるコードの先頭に移動（ホイスト）する必要があります。

```ts
// 1.2 walk import declarations of <script setup>
for (const node of scriptSetupAst.body) {
  if (node.type === "ImportDeclaration") {
    // インポートをファイル先頭に移動
    hoistNode(node)

    // 重複インポートの除去
    for (let i = 0; i < node.specifiers.length; i++) {
      const specifier = node.specifiers[i]
      const local = specifier.local.name
      const imported = getImportedName(specifier)
      const source = node.source.value

      const existing = userImports[local]
      if (existing) {
        if (existing.source === source && existing.imported === imported) {
          removeSpecifier(i)
        }
      } else {
        registerUserImport(source, local, imported, true)
      }
    }
  }
}
```

<KawaikoNote variant="question" title="なぜホイストが必要？">

生成されるコードでは，インポート文は `setup()` 関数の外に配置される必要があります。\
`<script setup>` 内に書かれたインポートを正しい位置に移動するのがホイストです。

</KawaikoNote>

## バインディングの解析

テンプレートから参照される変数を正しく解決するため，スクリプト内のバインディングを解析します。

```ts
function walkDeclaration(
  node: Declaration,
  bindings: Record<string, BindingTypes>,
  userImportAliases: Record<string, string> = {},
) {
  if (node.type === "VariableDeclaration") {
    const isConst = node.kind === "const"

    for (const { id, init } of node.declarations) {
      if (id.type === "Identifier") {
        let bindingType
        if (isConst && isStaticNode(init!)) {
          bindingType = BindingTypes.LITERAL_CONST
        } else if (isCallOf(init, userImportAliases["reactive"])) {
          bindingType = BindingTypes.SETUP_REACTIVE_CONST
        } else if (isCallOf(init, userImportAliases["ref"])) {
          bindingType = BindingTypes.SETUP_REF
        } else if (isConst) {
          bindingType = BindingTypes.SETUP_MAYBE_REF
        } else {
          bindingType = BindingTypes.SETUP_LET
        }
        registerBinding(bindings, id, bindingType)
      }
    }
  } else if (node.type === "FunctionDeclaration") {
    bindings[node.id!.name] = BindingTypes.SETUP_CONST
  }
}
```

バインディングタイプによって，テンプレート内での参照方法が変わります：

| タイプ | 説明 | テンプレートでの参照 |
|--------|------|---------------------|
| `SETUP_REF` | ref() で作成 | `.value` を自動追加 |
| `SETUP_REACTIVE_CONST` | reactive() で作成 | そのまま参照 |
| `SETUP_CONST` | 定数 | そのまま参照 |
| `SETUP_LET` | let/var 変数 | そのまま参照 |

## インラインテンプレート

script setup を使う場合，テンプレートは setup 関数内にインライン化できます。

```ts
// 10. generate return statement
let returned
if (options.inlineTemplate) {
  if (sfc.template) {
    const { code, preamble } = compileTemplate({
      source: sfc.template.content.trim(),
      compilerOptions: { inline: true, bindingMetadata },
    })

    if (preamble) {
      s.prepend(preamble)
    }
    returned = code
  } else {
    returned = `() => {}`
  }
}
s.appendRight(endOffset, `\nreturn ${returned}\n`)
```

生成されるコードの例：

```ts
// 入力
// <script setup>
// import { ref } from 'chibivue'
// const count = ref(0)
// </script>
// <template>
//   <p>{{ count }}</p>
// </template>

// 出力
import { ref } from 'chibivue'

export default {
  setup(__props) {
    const count = ref(0)

    return (_ctx) => {
      return h('p', count.value)
    }
  }
}
```

## Vite プラグインとの連携

Vite プラグインでは，script setup の検出とコンパイルを行います。

```ts
// packages/@extensions/vite-plugin-chibivue/src/script.ts

export function resolveScript(
  descriptor: SFCDescriptor,
  options: ResolvedOptions,
): SFCScriptBlock | null {
  if (!descriptor.script && !descriptor.scriptSetup) return null

  return options.compiler.compileScript(descriptor, {
    inlineTemplate: isUseInlineTemplate(descriptor),
  })
}

export function isUseInlineTemplate(descriptor: SFCDescriptor): boolean {
  return !!descriptor.scriptSetup
}
```

## 動作確認

```vue
<script setup>
import { ref, computed } from 'chibivue'

const count = ref(0)
const double = computed(() => count.value * 2)

const increment = () => {
  count.value++
}
</script>

<template>
  <div>
    <p>Count: {{ count }}</p>
    <p>Double: {{ double }}</p>
    <button @click="increment">+1</button>
  </div>
</template>
```

<KawaikoNote variant="base" title="実装完了！">

script setup の基本実装が完了しました！\
従来の書き方に比べてずっと簡潔にコンポーネントを記述できるようになりました。\
次の章では，`defineProps` と `defineEmits` マクロの実装を学びます。

</KawaikoNote>

## まとめ

- `<script setup>` は Composition API をより簡潔に書けるシンタックスシュガー
- `compileScript` が中心的な変換処理を担当
- インポートのホイストとバインディング解析が重要なステップ
- テンプレートは setup 関数内にインライン化される

## 参考リンク

- [Vue.js - script setup](https://vuejs.org/api/sfc-script-setup.html) - Vue 公式ドキュメント
- [RFC: script setup](https://github.com/vuejs/rfcs/blob/master/active-rfcs/0040-script-setup.md) - Vue RFC
