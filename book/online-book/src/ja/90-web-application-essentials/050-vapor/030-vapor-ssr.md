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
2. **VNode SSR の再利用**: サーバーサイドでは通常の VNode ベースの SSR を使用し，クライアントで Vapor としてハイドレート

Vue.js の [PR #13226](https://github.com/vuejs/core/pull/13226) では，2 番目のアプローチが採用されています．chibivue でも同様のアプローチを実装しています．

<KawaikoNote variant="base" title="Vue.js のアプローチ">
Vue.js の Vapor SSR は，サーバーサイドでは既存の VNode ベースの SSR（compiler-ssr）を使用し，クライアントサイドでは `createVaporSSRApp` を使ってハイドレーションを行います．これにより，SSR のための別のコンパイラを作成する必要がなくなります．
</KawaikoNote>

## 実装方式

### サーバーサイド: VNode SSR の利用

Vapor SSR では，サーバーサイドで Vapor コンポーネントを通常の VNode ベースのコンポーネントとしてコンパイルします．これにより `@chibivue/compiler-ssr` がそのまま使用できます．

```ts
// compiler-sfc/src/compileTemplate.ts
export function compileTemplate({
  source,
  ssr = false,
  vapor = false,
}: SFCTemplateCompileOptions): SFCTemplateCompileResults {
  // Vapor + SSR モードでも compiler-ssr を使用
  const defaultCompiler = ssr
    ? (CompilerSSR as TemplateCompiler)
    : CompilerDOM;

  let { code, ast, preamble } = defaultCompiler.compile(source, {
    ...compilerOptions,
    ssr,
  });

  // Vapor + SSR モードでは __vapor フラグを追加
  if (vapor && ssr) {
    code = code.replace(
      /export (function|const) ssrRender/,
      "export const __vapor = true;\nexport $1 ssrRender",
    );
  }

  return { code, ast, source, preamble };
}
```

`__vapor` フラグは，ハイドレーション時に Vapor モードを使用することを示します．

### クライアントサイド: createVaporSSRApp

クライアントサイドでは，`createVaporSSRApp` を使用して SSR でレンダリングされた HTML をハイドレートします．

```ts
// runtime-vapor/src/apiCreateVaporApp.ts
export function createVaporSSRApp(rootComponent: VaporComponent): VaporApp {
  const context = createAppContext();

  const app: VaporApp = {
    // ... 共通のアプリ設定 ...

    mount(containerOrSelector: Element | string) {
      const container = typeof containerOrSelector === "string"
        ? document.querySelector(containerOrSelector)
        : containerOrSelector;

      if (container?.hasChildNodes()) {
        // SSR コンテンツが存在する場合はハイドレーション
        const vnode = createVNode(rootComponent as any);
        vnode.appContext = context;
        const instance = hydrateVaporComponent(vnode, container, null);
        app._instance = instance;
      } else {
        // SSR コンテンツがない場合は通常のマウント
        // ...
      }
    },
  };

  return app;
}
```

### ハイドレーション

ハイドレーションプロセスでは，既存の DOM 要素を再利用しながらリアクティビティとイベントリスナーを設定します．

```ts
// runtime-vapor/src/hydration.ts
export function hydrateVaporComponent(
  vnode: VNode,
  container: Element,
  parentInstance: VaporComponentInternalInstance | null = null,
): VaporComponentInternalInstance {
  const instance = createVaporComponentInstance(vnode, parentInstance);

  // ハイドレーションコンテキストを設定
  const ctx: VaporHydrationContext = {
    node: container.firstChild,
    parent: container,
  };

  setCurrentInstance(instance as any);
  (instance as any).__hydrationCtx = ctx;

  try {
    const comp = instance.type as VaporComponent;
    // コンポーネントを実行 - template() は既存の DOM を見つける
    const el = comp(instance);

    // マウント完了
    instance.isMounted = true;

    // mounted フックを呼び出し
    const { m } = instance as any;
    if (m) invokeArrayFns(m);

    return instance;
  } finally {
    unsetCurrentInstance();
    delete (instance as any).__hydrationCtx;
  }
}
```

## Mock DOM アプローチ

chibivue では Mock DOM アプローチも `server-renderer` に実装しています．これは VNode SSR を使わない場合のフォールバックとして機能します．

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

## 使用例

### サーバーサイド

```ts
import { createVNode } from "chibivue";
import { renderToString } from "@chibivue/server-renderer";
import App from "./App.vue";

// コンポーネントを HTML 文字列にレンダリング
const html = await renderToString(createVNode(App));

// HTML レスポンスを送信
res.send(`
<!DOCTYPE html>
<html>
  <head><title>My App</title></head>
  <body>
    <div id="app">${html}</div>
    <script type="module" src="/src/entry-client.ts"></script>
  </body>
</html>
`);
```

### クライアントサイド

```ts
// entry-client.ts
import { createVaporSSRApp } from "@chibivue/runtime-vapor";
import App from "./App.vue";

// SSR でレンダリングされた HTML をハイドレート
createVaporSSRApp(App).mount("#app");
```

## 仮想 DOM SSR との比較

| 観点 | 仮想 DOM SSR | Vapor SSR |
|--------|-----------------|-----------|
| サーバーレンダリング | VNode ツリーを走査し，HTML を生成 | 同じ（VNode SSR を利用） |
| クライアントハイドレーション | VNode diff を使用 | DOM を直接参照・操作 |
| バンドルサイズ | 仮想 DOM ランタイムが必要 | 軽量な Vapor ランタイム |
| 更新パフォーマンス | diff アルゴリズムを経由 | 直接 DOM 操作 |

## アーキテクチャの利点

Vue.js スタイルの Vapor SSR アプローチには以下の利点があります：

1. **コードの再利用**: 既存の `compiler-ssr` をそのまま使用可能
2. **一貫した出力**: サーバーで生成される HTML は通常の VNode SSR と同一
3. **段階的な移行**: Vapor を使わないコンポーネントと混在可能
4. **保守性**: SSR 用の別コンパイラを維持する必要がない

<KawaikoNote variant="warning" title="ハイドレーションが必要">
サーバーでレンダリングされた HTML は静的です．インタラクティビティを得るには，クライアントサイドで Vapor コンポーネントをハイドレートする必要があります．これにより，リアクティブ effect とイベントリスナーが設定されます．
</KawaikoNote>

## 制限事項

現在の実装は最小限であり，いくつかの制限があります：

1. **ストリーミング非対応**: コンポーネント全体がレンダリングされてから返される
2. **Suspense 非対応**: 非同期コンポーネントの SSR サポートは限定的
3. **ハイドレーションミスマッチ**: クライアントとサーバーの出力が異なる場合の警告機能は未実装

<KawaikoNote variant="base" title="将来の改善">
より完全な実装には以下が含まれます：
- ストリーミング SSR サポート
- ハイドレーションミスマッチ検出
- Suspense との統合
</KawaikoNote>

## まとめ

Vapor SSR は以下のように動作します：

1. **サーバーサイド**: `compiler-ssr` を使用して HTML 文字列を生成（VNode SSR と同じ）
2. **クライアントサイド**: `createVaporSSRApp` を使用してハイドレーション
3. **ハイドレーション**: 既存の DOM 要素を再利用しながらリアクティビティを設定

このアプローチにより，Vapor コンポーネントは SSR のメリットを享受しながら，クライアントサイドでは直接 DOM 操作のパフォーマンスメリットを得ることができます．
