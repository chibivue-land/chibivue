# 型ベースの defineProps / defineEmits

::: info この章について
この章では，TypeScript の型引数を使った `defineProps` と `defineEmits` の実装方法を学びます。\
型定義からランタイム定義を生成する仕組みを理解しましょう。
:::

## 型ベースの宣言とは

Vue 3 では，`defineProps` と `defineEmits` を TypeScript のジェネリクスで宣言できます。

```vue
<script setup lang="ts">
// 型ベースの defineProps
const props = defineProps<{
  count: number
  message?: string
}>()

// 型ベースの defineEmits
const emit = defineEmits<{
  (e: 'change', value: string): void
  (e: 'update', id: number): void
}>()
</script>
```

<KawaikoNote variant="question" title="なぜ型ベースが便利？">

ランタイム宣言では `Number`, `String` などを使いますが，\
型ベースなら TypeScript の型システムをそのまま使えます！\
IDE の補完やエラーチェックも強力になります。

</KawaikoNote>

## 実装の仕組み

型ベースのマクロは以下のステップで処理されます：

1. **型引数の検出**: `defineProps<T>()` のジェネリクスを検出
2. **型の解析**: TypeScript の型定義を解析
3. **ランタイム定義の生成**: 型からランタイム用の props/emits を生成
4. **コードの出力**: 通常のランタイム宣言として出力

### 変換の例

```vue
<!-- 入力 -->
<script setup lang="ts">
const props = defineProps<{
  count: number
  message?: string
}>()
</script>
```

```ts
// 出力
export default {
  props: {
    count: { type: Number, required: true },
    message: { type: String, required: false }
  },
  setup(__props) {
    // ...
  }
}
```

## 型引数の検出

`defineProps` や `defineEmits` が型引数を持っているかを検出します。

```ts
// packages/compiler-sfc/src/compileScript.ts

let propsTypeDecl: TSTypeLiteral | TSInterfaceBody | undefined

function processDefineProps(node: Node, declId?: LVal): boolean {
  if (!isCallOf(node, DEFINE_PROPS)) {
    return false
  }

  const callExpr = node as CallExpression

  // 型引数をチェック
  if (callExpr.typeParameters) {
    const typeArg = callExpr.typeParameters.params[0]
    if (typeArg) {
      propsTypeDecl = resolveTypeElements(typeArg)
    }
  } else {
    // ランタイム宣言
    propsRuntimeDecl = node.arguments[0]
  }

  // ...
  return true
}
```

## 型の解析

TypeScript の型リテラルを解析して，プロパティ情報を抽出します。

```ts
interface PropTypeData {
  type: string[]      // 型の配列 (Union 対応)
  required: boolean   // 必須かどうか
}

function extractPropsFromType(
  typeDecl: TSTypeLiteral | TSInterfaceBody
): Record<string, PropTypeData> {
  const props: Record<string, PropTypeData> = {}

  const members = typeDecl.type === "TSTypeLiteral"
    ? typeDecl.members
    : typeDecl.body

  for (const member of members) {
    if (member.type === "TSPropertySignature") {
      const key = member.key
      if (key.type !== "Identifier") continue

      const propName = key.name
      const isOptional = !!member.optional

      // 型を解析
      const types = member.typeAnnotation
        ? resolveType(member.typeAnnotation.typeAnnotation)
        : ["null"]

      props[propName] = {
        type: types,
        required: !isOptional
      }
    }
  }

  return props
}
```

## 型からコンストラクタへの変換

TypeScript の型を JavaScript のコンストラクタに変換します。

```ts
function resolveType(node: TSType): string[] {
  switch (node.type) {
    case "TSStringKeyword":
      return ["String"]

    case "TSNumberKeyword":
      return ["Number"]

    case "TSBooleanKeyword":
      return ["Boolean"]

    case "TSArrayType":
      return ["Array"]

    case "TSFunctionType":
      return ["Function"]

    case "TSObjectKeyword":
    case "TSTypeLiteral":
      return ["Object"]

    case "TSUnionType":
      // Union 型は複数のコンストラクタを返す
      const types: string[] = []
      for (const t of node.types) {
        // null/undefined は除外
        if (t.type === "TSNullKeyword" || t.type === "TSUndefinedKeyword") {
          continue
        }
        types.push(...resolveType(t))
      }
      return types

    case "TSTypeReference":
      // カスタム型や参照型
      if (node.typeName.type === "Identifier") {
        const name = node.typeName.name
        // 組み込み型のマッピング
        if (name === "Array") return ["Array"]
        if (name === "Function") return ["Function"]
        if (name === "Object") return ["Object"]
        // その他はそのまま
        return [name]
      }
      return ["Object"]

    default:
      return ["null"]
  }
}
```

## ランタイム定義の生成

解析した型情報からランタイム用の props 定義を生成します。

```ts
function genRuntimePropsFromType(
  propsDecl: Record<string, PropTypeData>
): string {
  const props: string[] = []

  for (const [key, { type, required }] of Object.entries(propsDecl)) {
    const typeStr = type.length === 1
      ? type[0]
      : `[${type.join(", ")}]`

    if (required) {
      props.push(`${key}: { type: ${typeStr}, required: true }`)
    } else {
      props.push(`${key}: { type: ${typeStr}, required: false }`)
    }
  }

  return `{ ${props.join(", ")} }`
}
```

<KawaikoNote variant="surprise" title="コンパイル時の型消去！">

TypeScript の型は JavaScript にコンパイルされると消えてしまいます。\
Vue のコンパイラは，型情報をランタイム定義に変換することで，\
型の恩恵をランタイムでも受けられるようにしています！

</KawaikoNote>

## defineEmits の型処理

`defineEmits` も同様に型引数を処理します。

```ts
let emitsTypeDecl: TSFunctionType[] | undefined

function processDefineEmits(node: Node, declId?: LVal): boolean {
  if (!isCallOf(node, DEFINE_EMITS)) {
    return false
  }

  const callExpr = node as CallExpression

  if (callExpr.typeParameters) {
    const typeArg = callExpr.typeParameters.params[0]
    emitsTypeDecl = resolveEmitsTypeElements(typeArg)
  } else {
    emitsRuntimeDecl = node.arguments[0]
  }

  // ...
  return true
}

function resolveEmitsTypeElements(
  typeArg: TSType
): TSFunctionType[] | undefined {
  // 関数オーバーロード形式
  if (typeArg.type === "TSTypeLiteral") {
    return typeArg.members
      .filter((m): m is TSCallSignatureDeclaration =>
        m.type === "TSCallSignatureDeclaration"
      )
      .map(m => m as unknown as TSFunctionType)
  }
  return undefined
}
```

## emits のランタイム定義生成

```ts
function genRuntimeEmitsFromType(
  emitsDecl: TSFunctionType[]
): string {
  const events: string[] = []

  for (const sig of emitsDecl) {
    // 最初の引数がイベント名
    const firstParam = sig.parameters?.[0]
    if (firstParam?.type === "Identifier" && firstParam.typeAnnotation) {
      const typeAnn = firstParam.typeAnnotation.typeAnnotation
      if (typeAnn.type === "TSLiteralType" &&
          typeAnn.literal.type === "StringLiteral") {
        events.push(`"${typeAnn.literal.value}"`)
      }
    }
  }

  return `[${events.join(", ")}]`
}
```

### 変換例

```vue
<!-- 入力 -->
<script setup lang="ts">
const emit = defineEmits<{
  (e: 'change', value: string): void
  (e: 'update', id: number): void
}>()
</script>
```

```ts
// 出力
export default {
  emits: ['change', 'update'],
  setup(__props, { emit }) {
    // ...
  }
}
```

## withDefaults の対応

型ベースの props でデフォルト値を指定するには `withDefaults` を使います。

```vue
<script setup lang="ts">
interface Props {
  count: number
  message?: string
}

const props = withDefaults(defineProps<Props>(), {
  message: 'default message'
})
</script>
```

```ts
const WITH_DEFAULTS = "withDefaults"

function processWithDefaults(node: Node): boolean {
  if (!isCallOf(node, WITH_DEFAULTS)) {
    return false
  }

  const [propsCall, defaultsArg] = node.arguments

  // defineProps を処理
  if (isCallOf(propsCall, DEFINE_PROPS)) {
    processDefineProps(propsCall)
  }

  // デフォルト値を保存
  if (defaultsArg) {
    propsDefaults = defaultsArg
  }

  return true
}
```

## 動作確認

```vue
<!-- TypedComponent.vue -->
<script setup lang="ts">
interface Props {
  id: number
  name: string
  active?: boolean
}

interface Emits {
  (e: 'select', id: number): void
  (e: 'update', name: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

function handleClick() {
  emit('select', props.id)
}
</script>

<template>
  <div @click="handleClick">
    {{ name }} ({{ active ? 'active' : 'inactive' }})
  </div>
</template>
```

## 今後の拡張

現在の chibivue では型ベースのマクロは未実装ですが，以下の機能も検討できます：

- **インターフェース参照**: 別ファイルで定義した型の参照
- **Mapped Types**: `Partial<T>` などの変換型
- **Generic コンポーネント**: ジェネリック型パラメータを持つコンポーネント
- **型のみのインポート**: `import type` の処理

<KawaikoNote variant="base" title="実装に挑戦！">

この章で説明した仕組みを参考に，ぜひ型ベースのマクロを実装してみてください！\
TypeScript AST の操作を学ぶ良い機会になります。

</KawaikoNote>

ここまでのソースコード:
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/60_basic_sfc_compiler/060_type_based_macros)

## まとめ

- 型ベースの defineProps/defineEmits は TypeScript の型引数を使う
- コンパイラが型を解析してランタイム定義を生成
- TypeScript の型は JavaScript のコンストラクタにマッピング
- withDefaults でデフォルト値を指定可能

## 参考リンク

- [Vue.js - TypeScript with Composition API](https://vuejs.org/guide/typescript/composition-api.html) - Vue 公式ドキュメント
- [Vue.js - Type-only props/emit declarations](https://vuejs.org/api/sfc-script-setup.html#type-only-props-emit-declarations) - Vue 公式ドキュメント
