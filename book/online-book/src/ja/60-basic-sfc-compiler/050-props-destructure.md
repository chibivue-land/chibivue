# Props の分割代入に対応する

::: info この章について
この章では，Vue 3.5 で導入された Reactive Props Destructure 機能の実装方法を学びます。\
Props を分割代入しながらリアクティビティを維持する仕組みを理解しましょう。
:::

## Reactive Props Destructure とは

Vue 3.5 から，`<script setup>` 内で `defineProps` の戻り値を分割代入できるようになりました。

```vue
<script setup>
const { count, message = 'default' } = defineProps({
  count: Number,
  message: String
})
</script>

<template>
  <p>{{ count }} - {{ message }}</p>
</template>
```

この機能により，props へのアクセスがよりシンプルになります。

<KawaikoNote variant="question" title="なぜ特別な対応が必要？">

通常の JavaScript では，オブジェクトを分割代入すると値がコピーされ，元のオブジェクトとの接続が切れます。\
しかし Vue の props はリアクティブである必要があります。\
コンパイラが分割代入を `__props.xxx` へのアクセスに変換することで，リアクティビティを維持します！

</KawaikoNote>

## 実装の仕組み

Props の分割代入は以下のステップで実現されます：

1. **パターンの検出**: `const { ... } = defineProps(...)` を検出
2. **バインディングの登録**: 分割代入された各プロパティを `PROPS` として登録
3. **デフォルト値の処理**: デフォルト値を `withDefaults` 相当の処理に変換
4. **コードの変換**: props アクセスを `__props.xxx` に変換

### 変換の例

```vue
<!-- 入力 -->
<script setup>
const { count, message = 'hello' } = defineProps({
  count: Number,
  message: String
})

console.log(count, message)
</script>
```

```ts
// 出力
export default {
  props: {
    count: Number,
    message: { type: String, default: 'hello' }
  },
  setup(__props) {
    console.log(__props.count, __props.message)

    return (_ctx) => {
      // ...
    }
  }
}
```

## 分割代入パターンの検出

`defineProps` の戻り値が `ObjectPattern`（分割代入パターン）に代入されているかを検出します。

```ts
// packages/compiler-sfc/src/compileScript.ts

interface PropsDestructureBindings {
  [key: string]: {
    local: string      // ローカル変数名
    default?: string   // デフォルト値
  }
}

let propsDestructuredBindings: PropsDestructureBindings = Object.create(null)

function processDefineProps(node: Node, declId?: LVal): boolean {
  if (!isCallOf(node, DEFINE_PROPS)) {
    return false
  }

  propsRuntimeDecl = node.arguments[0]

  // 分割代入パターンの処理
  if (declId && declId.type === "ObjectPattern") {
    processPropsDestructure(declId)
  } else if (declId) {
    propsIdentifier = scriptSetup!.content.slice(declId.start!, declId.end!)
  }

  return true
}
```

## 分割代入の処理

`ObjectPattern` から各プロパティを抽出し，バインディングとして登録します。

```ts
function processPropsDestructure(pattern: ObjectPattern) {
  for (const prop of pattern.properties) {
    if (prop.type === "ObjectProperty") {
      const key = prop.key
      const value = prop.value

      // プロパティ名を取得
      let propKey: string
      if (key.type === "Identifier") {
        propKey = key.name
      } else if (key.type === "StringLiteral") {
        propKey = key.value
      } else {
        continue
      }

      // ローカル変数名とデフォルト値を処理
      let local: string
      let defaultValue: string | undefined

      if (value.type === "Identifier") {
        // const { count } = defineProps(...)
        local = value.name
      } else if (value.type === "AssignmentPattern") {
        // const { count = 0 } = defineProps(...)
        if (value.left.type === "Identifier") {
          local = value.left.name
          defaultValue = scriptSetup!.content.slice(
            value.right.start!,
            value.right.end!
          )
        } else {
          continue
        }
      } else {
        continue
      }

      // バインディングを登録
      propsDestructuredBindings[propKey] = { local, default: defaultValue }
      bindingMetadata[local] = BindingTypes.PROPS
    }
  }
}
```

## デフォルト値の処理

分割代入でデフォルト値が指定された場合，props 定義にマージします。

```ts
function genRuntimeProps(): string | undefined {
  if (!propsRuntimeDecl) return undefined

  let propsString = scriptSetup!.content.slice(
    propsRuntimeDecl.start!,
    propsRuntimeDecl.end!
  )

  // デフォルト値がある場合はマージ
  const defaults: Record<string, string> = {}
  for (const key in propsDestructuredBindings) {
    const binding = propsDestructuredBindings[key]
    if (binding.default) {
      defaults[key] = binding.default
    }
  }

  if (Object.keys(defaults).length > 0) {
    // withDefaults 相当の処理
    propsString = mergeDefaults(propsString, defaults)
  }

  return propsString
}

function mergeDefaults(
  propsString: string,
  defaults: Record<string, string>
): string {
  // 実際の実装では AST を操作してデフォルト値をマージ
  // ここでは簡略化した例
  const ast = parseExpression(propsString)
  // ... デフォルト値をマージする処理
  return generate(ast).code
}
```

## Props アクセスの変換

テンプレートおよびスクリプト内で，分割代入された変数へのアクセスを `__props.xxx` に変換します。

```ts
function processPropsAccess(source: string): string {
  const s = new MagicString(source)

  // 識別子を走査して変換
  walk(scriptSetupAst, {
    enter(node: Node) {
      if (node.type === "Identifier") {
        const binding = propsDestructuredBindings[node.name]
        if (binding && binding.local === node.name) {
          // props アクセスに変換
          s.overwrite(node.start!, node.end!, `__props.${node.name}`)
        }
      }
    }
  })

  return s.toString()
}
```

<KawaikoNote variant="surprise" title="コンパイラの魔法！">

分割代入は通常 JavaScript の動作ではリアクティビティを失いますが，\
コンパイラが `__props.xxx` へのアクセスに変換することで，\
シンタックスシュガーとして分割代入の書き方を使えるようになります！

</KawaikoNote>

## Rest パターンの対応

`...rest` パターンにも対応できます。

```vue
<script setup>
const { id, ...attrs } = defineProps(['id', 'class', 'style'])
</script>
```

```ts
function processPropsDestructure(pattern: ObjectPattern) {
  for (const prop of pattern.properties) {
    if (prop.type === "RestElement") {
      // Rest パターンの処理
      if (prop.argument.type === "Identifier") {
        const restName = prop.argument.name
        // rest は特別な処理が必要
        // 実際には computed を使って残りの props を取得
        bindingMetadata[restName] = BindingTypes.SETUP_REACTIVE_CONST
      }
    }
    // ...
  }
}
```

## 動作確認

```vue
<!-- Parent.vue -->
<script setup>
import { ref } from 'chibivue'
import Child from './Child.vue'

const count = ref(0)
const message = ref('Hello')
</script>

<template>
  <Child :count="count" :message="message" />
  <button @click="count++">Increment</button>
</template>
```

```vue
<!-- Child.vue -->
<script setup>
const { count, message = 'default' } = defineProps({
  count: Number,
  message: String
})

// count と message は __props.count, __props.message に変換される
console.log(count, message)
</script>

<template>
  <p>{{ count }} - {{ message }}</p>
</template>
```

## 今後の拡張

現在の chibivue では Props Destructure は未実装ですが，以下の機能も検討できます：

- **エイリアス対応**: `const { count: c } = defineProps(...)` の対応
- **ネストした分割代入**: `const { user: { name } } = defineProps(...)` の対応
- **配列パターン**: 配列形式の props 定義との組み合わせ

<KawaikoNote variant="base" title="実装に挑戦！">

この章で説明した仕組みを参考に，ぜひ Props Destructure を実装してみてください！\
AST の操作と変換の良い練習になります。

</KawaikoNote>

## まとめ

- Props Destructure は Vue 3.5 で導入された機能
- 分割代入パターンを検出し，各プロパティを `PROPS` バインディングとして登録
- デフォルト値は props 定義にマージ
- 変数アクセスを `__props.xxx` に変換してリアクティビティを維持

## 参考リンク

- [Vue.js - Reactive Props Destructure](https://vuejs.org/guide/components/props.html#reactive-props-destructure) - Vue 公式ドキュメント
- [RFC - Reactive Props Destructure](https://github.com/vuejs/rfcs/discussions/502) - Vue RFC
