# Vapor Compiler

前のセクションでは，Vapor Mode の基盤となるランタイム関数（`template`, `setText`, `on`）を見てきました．
このセクションでは，これらの関数を使ったコードをテンプレートから自動生成するコンパイラを実装してみましょう．

## Vapor コンパイラの目標

Vapor コンパイラの目標は，このようなテンプレートを：

```html
<button @click="count++">{{ count }}</button>
```

このようなコードに変換することです：

```ts
import { template as _template, setText as _setText, on as _on, renderEffect as _renderEffect } from "@chibivue/runtime-vapor"

((_self) => {
  const _root = _template(`<button><!----></button>`);
  const _el0 = _root.firstChild;
  _renderEffect(() => {
    _setText(_el0, "", count.value);
  });
  _on(_root, "click", () => count++);
  return _root;
})
```

ポイントは以下の通りです：

1. **静的な部分はテンプレート文字列になる**: HTML 構造は文字列として事前に作成される
2. **動的な部分は renderEffect で処理される**: リアクティブな値の変更が直接 DOM 更新をトリガーする
3. **イベントハンドラは直接アタッチされる**: 仮想 DOM のイベント委譲なし

## コンパイラのアーキテクチャ

Vapor コンパイラは，通常のテンプレートコンパイラと同様のパイプラインに従いますが，中間表現（IR）を使ったより洗練されたアプローチを採用しています：

```
テンプレート (string)
  ↓ [Parse]
AST (Abstract Syntax Tree)
  ↓ [Transform]
IR (Intermediate Representation)
  ↓ [Codegen]
Vapor コード (string)
```

## IR (Intermediate Representation) とは

IR（中間表現）は，AST と最終的なコードの間に位置するデータ構造です．
IR を使う利点は以下の通りです：

1. **関心の分離**: パースとコード生成を明確に分離できる
2. **最適化の容易さ**: IR レベルで静的解析や最適化が行いやすい
3. **拡張性**: 新しい機能の追加が容易

### IR の構造

```ts
// IR ノードの種類
enum IRNodeTypes {
  ROOT = "root",
  BLOCK = "block",
  SET_TEXT = "setText",
  SET_EVENT = "setEvent",
  SET_PROP = "setProp",
  IF = "if",
  FOR = "for",
}

// ブロック IR ノード - 操作とエフェクトのコンテナ
interface BlockIRNode {
  type: IRNodeTypes.BLOCK;
  node: RootNode | TemplateChildNode;
  dynamic: IRDynamicInfo;
  effect: IREffect[];      // リアクティブな操作
  operation: OperationNode[]; // 非リアクティブな操作
  returns: number[];       // 返す要素の ID
}

// エフェクト - リアクティブな依存関係と操作のセット
interface IREffect {
  expressions: SimpleExpressionNode[]; // 依存する式
  operations: OperationNode[];         // 実行する操作
}
```

### 操作ノードの例

```ts
// テキスト更新
interface SetTextIRNode {
  type: IRNodeTypes.SET_TEXT;
  element: number;  // 要素 ID
  values: SimpleExpressionNode[];
}

// イベントバインディング
interface SetEventIRNode {
  type: IRNodeTypes.SET_EVENT;
  element: number;
  key: string;      // イベント名
  value: SimpleExpressionNode;
  modifiers?: string[];
}

// プロパティバインディング
interface SetPropIRNode {
  type: IRNodeTypes.SET_PROP;
  element: number;
  key: string;
  value: SimpleExpressionNode;
}
```

## Transformer の役割

Transformer は AST を IR に変換するコンポーネントです．
各 AST ノードを走査し，適切な IR ノードを生成します．

### TransformContext

```ts
interface TransformContext {
  root: RootIRNode;
  block: BlockIRNode;
  template: string;        // 静的テンプレート文字列
  elementCount: number;

  // 要素 ID を割り当て
  reference(): number;

  // リアクティブなエフェクトを登録
  registerEffect(expressions: SimpleExpressionNode[], operations: OperationNode[]): void;

  // 非リアクティブな操作を登録
  registerOperation(...operations: OperationNode[]): void;

  // 新しいブロックに入る（v-if, v-for 用）
  enterBlock(block: BlockIRNode): () => void;
}
```

### 変換の流れ

```ts
export function transform(ast: RootNode, source: string): RootIRNode {
  const ir = createRootIR(ast, source);
  const context = createTransformContext(ir);

  // 子要素を再帰的に変換
  transformChildren(ast.children, context);

  // テンプレート文字列を保存
  ir.template.push(context.template);

  return ir;
}
```

### ディレクティブの変換

各ディレクティブは専用の変換関数で処理されます：

```ts
// v-on の変換
function transformVOn(dir: DirectiveNode, elementId: number, context: TransformContext): void {
  if (!dir.arg || !dir.exp) return;

  const eventName = (dir.arg as SimpleExpressionNode).content;

  // イベントは operation として登録（リアクティブではない）
  context.registerOperation({
    type: IRNodeTypes.SET_EVENT,
    element: elementId,
    key: eventName,
    value: dir.exp as SimpleExpressionNode,
    modifiers: dir.modifiers,
  });
}

// v-bind の変換
function transformVBind(dir: DirectiveNode, elementId: number, context: TransformContext): void {
  if (!dir.arg || !dir.exp) return;

  const propName = (dir.arg as SimpleExpressionNode).content;

  // effect として登録（リアクティブ）
  context.registerEffect([dir.exp as SimpleExpressionNode], [
    {
      type: IRNodeTypes.SET_PROP,
      element: elementId,
      key: propName,
      value: dir.exp as SimpleExpressionNode,
    },
  ]);
}
```

### 定数式の最適化

`registerEffect` は式が定数かどうかをチェックし，定数の場合は `effect` ではなく通常の `operation` として登録します：

```ts
registerEffect(expressions: SimpleExpressionNode[], operations: OperationNode[]): void {
  // 定数式をフィルタリング
  const reactiveExpressions = expressions.filter((exp) => !isConstantExpression(exp));

  // リアクティブな依存がなければ operation として登録
  if (reactiveExpressions.length === 0) {
    context.registerOperation(...operations);
    return;
  }

  // effect として登録
  currentBlock.effect.push({
    expressions: reactiveExpressions,
    operations,
  });
}
```

## renderEffect とは

`renderEffect` は Vapor Mode の核心となる関数です．
仮想 DOM の差分検出アプローチとは異なり，リアクティブな依存関係を直接追跡し，変更時に DOM を更新します．

### 仕組み

```ts
/**
 * renderEffect - Vapor Mode でのリアクティブな DOM 更新のコアメカニズム
 *
 * 1. DOM 更新関数をリアクティブな effect でラップ
 * 2. アクセスされたリアクティブな値を自動的に追跡
 * 3. 追跡された値が変更されたら更新関数を再実行
 * 4. 変更が必要な特定の DOM ノードのみを更新
 *
 * 重要: renderEffect はライフサイクルフックも処理します:
 * - 各更新前に onBeforeUpdate フックを呼び出す（初回マウント後）
 * - 各更新後に onUpdated フックを呼び出す（初回マウント後）
 */
export const renderEffect = (fn: () => void): void => {
  const instance = currentInstance;

  effect(() => {
    // 更新前: onBeforeUpdate フックを呼び出す（マウント後のみ）
    if (instance?.isMounted) {
      const { bu } = instance;
      if (bu) invokeArrayFns(bu);
    }

    // 更新を実行
    fn();

    // 更新後: onUpdated フックを呼び出す（マウント後のみ）
    if (instance?.isMounted) {
      const { u } = instance;
      if (u) {
        queueMicrotask(() => invokeArrayFns(u));
      }
    }
  });
};
```

### 生成されるコードの例

```ts
// テンプレート: <span>{{ count }}</span>

renderEffect(() => {
  setText(_el0, "", count.value)
})

// count.value が変更されると:
// 1. onBeforeUpdate フックが呼び出される
// 2. テキスト内容が更新される
// 3. onUpdated フックが呼び出される（マイクロタスクで）
```

### 仮想 DOM との比較

| 観点 | 仮想 DOM | Vapor (renderEffect) |
|------|----------|---------------------|
| 更新粒度 | コンポーネント全体を再レンダー | 変更された部分のみ更新 |
| 追跡方法 | 差分アルゴリズム | リアクティブな依存追跡 |
| オーバーヘッド | VNode の作成と比較 | なし（直接 DOM 操作） |

## Codegen の実装

Codegen は IR からコードを生成します：

```ts
export function generateVaporFromIR(ir: RootIRNode, options = {}): VaporCodegenResult {
  const context = createVaporCodegenContext();

  // preamble（import 文など）を生成
  genVaporPreamble(context, options.isBrowser);

  // コンポーネント関数を生成
  push(`((_self) => {`);
  indent();

  // template() 呼び出しを生成
  push(`const _root = _template(\`${ir.template[0]}\`);`);

  // 要素参照を生成
  for (let i = 0; i < elementCount; i++) {
    push(`const _el${i} = _root${generateElementPath(i)};`);
  }

  // 非リアクティブな操作を生成
  for (const op of block.operation) {
    genOperation(op, context);
  }

  // リアクティブなエフェクトを生成
  for (const effect of block.effect) {
    push(`_renderEffect(() => {`);
    indent();
    for (const op of effect.operations) {
      genOperation(op, context);
    }
    deindent();
    push(`});`);
  }

  push(`return _root;`);
  deindent();
  push(`})`);

  return { code: context.code, preamble, ast: ir.node };
}
```

## 使用例

```ts
import { compile } from "@chibivue/compiler-vapor";

// IR ベースのコンパイル
const result = compile(`
  <button @click="count++" :class="btnClass">Count: {{ count }}</button>
`, { useIR: true });

console.log(result.code);
```

出力：

```ts
import { template as _template, setText as _setText, on as _on, setClass as _setClass, renderEffect as _renderEffect } from "@chibivue/runtime-vapor"

((_self) => {
  const _root = _template(`<button><!----></button>`);
  const _el0 = _root.firstChild;
  const _el1 = _root;
  _on(_el1, "click", count++);
  _renderEffect(() => {
    _setClass(_el1, btnClass);
  });
  _renderEffect(() => {
    _setText(_el0, "", count);
  });
  return _root;
})
```

## まとめ

Vapor コンパイラは，以下のパイプラインでテンプレートをコードに変換します：

1. **Parse**: テンプレートを AST に変換
2. **Transform**: AST を IR に変換（最適化を含む）
3. **Codegen**: IR からコードを生成

IR を使うことで：
- 静的解析と最適化が容易に
- コードの保守性が向上
- 新機能の追加が簡単に

`renderEffect` により：
- きめ細かなリアクティブ更新が可能
- 仮想 DOM のオーバーヘッドを排除
- 変更された部分のみを効率的に更新

次のセクションでは，SSR サポートによってサーバー上で Vapor コンポーネントをレンダリングする方法を見ていきます．
