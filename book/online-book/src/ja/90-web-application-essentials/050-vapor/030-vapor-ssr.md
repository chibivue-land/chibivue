# Vapor SSR

このセクションでは，サーバーサイドで Vapor コンポーネントをレンダリングする方法を探ります．
Vapor コンポーネントは DOM を直接操作しますが，サーバー上には DOM が存在しないため，Vapor の SSR（Server-Side Rendering）には独自の課題があります．

## 課題

Vapor コンポーネントは以下のように動作します：
1. `document.createElement` を使って DOM 要素を作成（`template()` 経由）
2. `textContent` や `addEventListener` などでそれらの要素を直接操作

サーバー上には `document` オブジェクトがありません．Vapor コンポーネントから HTML 文字列を生成するには，別のアプローチが必要です．

## 解決アプローチ

Vapor SSR には主に 2 つのアプローチがあります：

1. **Mock DOM**: DOM 操作をキャプチャして HTML に変換する疑似 DOM 環境を作成
2. **別の SSR コンパイラ**: HTML 文字列を直接出力する SSR 用の別コードを生成

chibivue では `server-renderer` に Mock DOM アプローチのシンプルなバージョンを実装しています．

## 実装

### SSR Elements

DOM 要素を模倣しつつ，データをメモリに保存するクラスを作成します：

```ts
class SSRElement {
  tagName: string;
  attributes: Map<string, string> = new Map();
  children: (SSRElement | SSRText)[] = [];
  textContent: string = "";

  constructor(tagName: string) {
    this.tagName = tagName.toLowerCase();
  }

  get firstChild(): SSRElement | SSRText | null {
    return this.children[0] || null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  addEventListener(): void {
    // SSR では何もしない - イベントはクライアントサイドのみ
  }

  appendChild(child: SSRElement | SSRText): void {
    this.children.push(child);
  }

  toHTML(): string {
    let html = `<${this.tagName}`;

    for (const [name, value] of this.attributes) {
      html += ` ${name}="${escapeHtml(value)}"`;
    }

    html += ">";

    if (this.textContent) {
      html += escapeHtml(this.textContent);
    } else {
      for (const child of this.children) {
        html += child.toHTML();
      }
    }

    html += `</${this.tagName}>`;
    return html;
  }
}
```

重要なポイントは，`toHTML()` がメモリ内の表現を HTML 文字列に変換することです．

### SSR Document

モックの `document` オブジェクトも作成します：

```ts
class SSRDocument {
  createElement(tagName: string): SSRElement {
    return new SSRElement(tagName);
  }

  createTextNode(text: string): SSRText {
    return new SSRText(text);
  }

  createComment(text: string): SSRText {
    return new SSRText(`<!--${text}-->`);
  }
}
```

### Vapor コンポーネントのレンダリング

`renderVaporComponentToString` 関数は SSR 環境を設定してコンポーネントを実行します：

```ts
export function renderVaporComponentToString(
  vnode: VNode,
  parentInstance: VaporComponentInternalInstance | null = null
): SSRBuffer | Promise<SSRBuffer> {
  const instance = createVaporComponentInstance(vnode, parentInstance);
  return renderVaporComponentSubTree(instance);
}

function renderVaporComponentSubTree(
  instance: VaporComponentInternalInstance
): SSRBuffer {
  const { getBuffer, push } = createBuffer();
  const comp = instance.type as VaporComponent;

  if (isFunction(comp)) {
    try {
      // SSR 環境を設定
      setupSSRVaporGlobals();

      // Vapor コンポーネントを実行
      comp(instance);

      // レンダリングされた HTML を取得
      push(ssrContext.getHTML());

      // グローバルを復元
      restoreVaporGlobals();
    } catch (e) {
      console.warn(`Vapor SSR render failed:`, e);
      push(`<!---->`);
    }
  }

  return getBuffer();
}
```

## SSR でのイベント処理

SSR では `addEventListener` が何もしないことに注目してください：

```ts
addEventListener(): void {
  // SSR では何もしない - イベントはクライアントサイドのみ
}
```

イベントハンドラはクライアントサイドでのみ動作します．ページがブラウザで読み込まれると，ハイドレーションが実際のイベントリスナーをアタッチします．

<KawaikoNote type="warning" title="ハイドレーションが必要">
サーバーでレンダリングされた HTML は静的です．インタラクティビティを得るには，クライアントサイドで Vapor コンポーネントをハイドレートする必要があります．これにより，リアクティブ effect とイベントリスナーが設定されます．
</KawaikoNote>

## SSR ヘルパー関数

SSR 出力を生成するためのヘルパー関数も提供しています：

```ts
// プレースホルダーサポート付きでテキストをレンダリング
export function ssrVaporSetText(format: string, ...values: any[]): string {
  let text = format;
  for (let i = 0; i < values.length; i++) {
    text = text.replace("{}", String(values[i]));
  }
  return escapeHtml(text);
}

// テンプレート HTML をパススルー
export function ssrVaporTemplate(html: string): string {
  return html;
}
```

## 使用例

サーバー上で Vapor コンポーネントをレンダリングする方法は以下のようになります：

```ts
import { createVNode } from "chibivue";
import { renderVaporComponentToString } from "@chibivue/server-renderer";

// シンプルな vapor コンポーネント
const Counter = (self) => {
  const el = template("<button>Count: 0</button>");
  return el;
};

// 文字列にレンダリング
const vnode = createVNode(Counter);
const buffer = await renderVaporComponentToString(vnode);
const html = unrollBuffer(buffer);

console.log(html);
// 出力: <button>Count: 0</button>
```

## 仮想 DOM SSR との比較

| 観点 | 仮想 DOM SSR | Vapor SSR |
|--------|-----------------|-----------|
| レンダリング | VNode ツリーを走査し，HTML を生成 | DOM をモック，操作をキャプチャ |
| 複雑さ | 単純な再帰レンダリング | DOM モッキングレイヤーが必要 |
| 出力 | 同じ HTML 構造 | 同じ HTML 構造 |
| ハイドレーション | 標準のハイドレーション | Vapor 固有のハイドレーションが必要 |

どちらのアプローチも同じ HTML 出力を生成しますが，実装は異なります．仮想 DOM アプローチは，実際の DOM 要素ではなくデータ構造（VNodes）で動作するため，概念的によりシンプルです．

## 制限事項

現在の実装は最小限であり，いくつかの制限があります：

1. **ストリーミング非対応**: コンポーネント全体がレンダリングされてから返される
2. **限定的な DOM API カバレッジ**: 基本的な DOM 操作のみモックされている
3. **非同期コンポーネント非対応**: 非同期 vapor コンポーネントは正しく動作しない可能性がある

<KawaikoNote type="info" title="将来の改善">
より完全な実装には以下が含まれます：
- 完全な DOM API モッキング
- 大きなページのためのストリーミングサポート
- 最適化された SSR 出力のための Vapor コンパイラとのより良い統合
</KawaikoNote>

## コンパイラベースの SSR

chibivue には，通常の VNode ベースのコンポーネント向けに `@chibivue/compiler-ssr` パッケージがあります．
このパッケージは，テンプレートを SSR に最適化されたコードにコンパイルし，VNode を経由せず直接 HTML 文字列を生成します．

詳細は [Compiler SSR](/ja/90-web-application-essentials/020-ssr/030-compiler-ssr) を参照してください．

Vapor コンポーネントの場合も，将来的には同様のコンパイラベースアプローチを採用することで，Mock DOM のオーバーヘッドを排除し，より効率的な SSR を実現できる可能性があります．

## まとめ

Vapor SSR は以下のように動作します：

1. 要素データをメモリに保存するモック DOM クラスを作成
2. レンダリング中にグローバルの `document` をモックに置き換え
3. Vapor コンポーネントを実行し，モック DOM ツリーを構築
4. モック DOM ツリーを HTML 文字列に変換

このアプローチにより，Vapor コンポーネントは修正なしでサーバー上で動作できますが，インタラクティビティを復元するにはクライアントでのハイドレーションステップが必要です．

Vapor Compiler と Vapor SSR の組み合わせにより，Vue アプリケーションをサーバーレンダリングする機能を維持しながら，直接 DOM 操作のパフォーマンスメリットを得ることができます．
