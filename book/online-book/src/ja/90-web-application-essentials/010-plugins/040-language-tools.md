# Language Tools

## Language Tools とは？

Language Tools は `.vue` Single File Components (SFCs) に対する IDE サポートを提供します．以下のような機能を実現します：

- シンタックスハイライト
- 自動補完
- 型チェック
- 定義へ移動
- エラー診断

Vue.js エコシステムでは，[vuejs/language-tools](https://github.com/vuejs/language-tools) がこの機能を提供しており，[Volar.js](https://volarjs.dev/) を基盤として構築されています．この章では，Volar.js を使って chibivue 用の最小限の Language Tools を実装します．

## なぜ Language Tools が必要なのか？

TypeScript の言語サービスは `.ts` や `.tsx` ファイルしか理解できません．しかし `.vue` ファイルは以下のように複数の言語が混在しています：

```vue
<template>
  <div>{{ message }}</div>  <!-- HTML + 式 -->
</template>

<script setup lang="ts">
const message = ref('Hello')  // TypeScript
</script>

<style scoped>
div { color: red; }  /* CSS */
</style>
```

Language Tools の役割は，この複合的なファイルを TypeScript 言語サービスが理解できる形式に**変換**することです．この変換により，`.vue` ファイル内でも TypeScript の全機能（型チェック，自動補完，リファクタリングなど）が利用可能になります．

## アーキテクチャ概要

Language Tools は 3 つの主要パッケージで構成されます：

```txt
@extensions/
├── chibivue-language-core/     # コア言語処理
│   ├── parseSfc.ts             # SFC パーサー
│   ├── virtualCode.ts          # 仮想コード生成
│   ├── languagePlugin.ts       # Volar.js プラグイン
│   └── types.ts                # 型定義
├── chibivue-language-server/   # LSP サーバー
│   └── server.ts               # Language Server Protocol サーバー
└── vscode-chibivue/            # VSCode 拡張機能
    ├── extension.ts            # 拡張機能エントリーポイント
    ├── syntaxes/               # TextMate 文法
    └── language-configuration.json
```

### データフロー

エディタで `.vue` ファイルを編集したとき，以下の流れでデータが処理されます：

```txt
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VSCode                                         │
│  ┌─────────────┐                                                            │
│  │  App.vue    │  ユーザーが .vue ファイルを編集                            │
│  └──────┬──────┘                                                            │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────┐                                                    │
│  │  vscode-chibivue    │  VSCode 拡張機能がファイル変更を検知               │
│  │  (Language Client)  │                                                    │
│  └──────────┬──────────┘                                                    │
└─────────────┼───────────────────────────────────────────────────────────────┘
              │ LSP (Language Server Protocol)
              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  chibivue-language-server                                                   │
│  ┌─────────────────────┐                                                    │
│  │  Language Server    │  LSP リクエストを受信                              │
│  └──────────┬──────────┘                                                    │
│             │                                                               │
│             ▼                                                               │
│  ┌─────────────────────┐    ┌─────────────────────┐                         │
│  │  chibivue-language  │───▶│  Virtual Code       │                         │
│  │  -core (Plugin)     │    │  (.vue → .ts 変換)  │                         │
│  └─────────────────────┘    └──────────┬──────────┘                         │
│                                        │                                    │
│                                        ▼                                    │
│                             ┌─────────────────────┐                         │
│                             │  TypeScript         │                         │
│                             │  Language Service   │  型チェック・補完など   │
│                             └──────────┬──────────┘                         │
│                                        │                                    │
│                                        ▼                                    │
│                             ┌─────────────────────┐                         │
│                             │  Code Mappings      │  結果を元の位置に変換   │
│                             └─────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## コアコンセプト

### 仮想コード (Virtual Code)

Language Tools の中核となる概念は**仮想コード**です．`.vue` ファイルを TypeScript に変換することで，TypeScript 言語サービスの全機能を活用できます．

#### 変換の例

```vue
<!-- 元の .vue ファイル -->
<template>
  <div>{{ message }}</div>
</template>

<script setup lang="ts">
import { ref } from 'chibivue'

const message = ref('Hello')
</script>
```

これは以下の仮想 TypeScript に変換されます：

```ts
// 仮想 TypeScript コード
import { ref } from 'chibivue'

const message = ref('Hello')

// テンプレート内の式を型チェックするためのコード
// 実際には実行されないが，TypeScript が式の型を検証できる
declare const __VLS_template: () => void;
(() => {
  // テンプレート内の {{ message }} に対応
  // message が存在し，型が正しいことを TypeScript が検証
  const __VLS_expr0 = (message);
})();
```

この変換により：
- `message` の型が `Ref<string>` であることが検証される
- `message` が未定義の場合，エラーが報告される
- `message` にホバーすると型情報が表示される

### コードマッピング

仮想コード内の位置を元の `.vue` ファイルの位置に対応付けるのが**コードマッピング**です．

```txt
元の .vue ファイル                    仮想 TypeScript
─────────────────────────────────────────────────────────────
<script setup lang="ts">
import { ref } from 'chibivue'  ←──→  import { ref } from 'chibivue'
                                      ↑
const message = ref('Hello')    ←──→  const message = ref('Hello')
</script>                             ↑
                                      │
<template>                            │
  <div>{{ message }}</div>      ←─────┼──→  const __VLS_expr0 = (message);
</template>                           │
                                      ↓
                                マッピングにより位置が対応付けられる
```

マッピングがあることで：
- 仮想コードでエラーが発生 → 元の `.vue` ファイルの正しい位置にエラーを表示
- 「定義へ移動」を実行 → 仮想コードの定義位置を元のファイルの位置に変換

## 実装

### 型定義

まず，SFC の構造を表現する型を定義します．

```ts
// types.ts

/**
 * SFC 内の各ブロック（template, script, style）を表現する型
 */
export interface SfcBlock {
  /** ブロックの種類（"template", "script", "style" など） */
  type: string;

  /** ブロック内のコンテンツ（タグを除いた中身） */
  content: string;

  /** ブロックの位置情報（エラー表示やマッピングに使用） */
  loc: {
    start: { line: number; column: number; offset: number };
    end: { line: number; column: number; offset: number };
  };

  /** ブロックの属性（例：lang="ts", scoped など） */
  attrs: Record<string, string | true>;

  /** 言語指定（attrs.lang のショートカット） */
  lang?: string;
}

/**
 * パース結果の SFC 全体を表現する型
 */
export interface SfcDescriptor {
  /** <template> ブロック */
  template: SfcBlock | null;

  /** <script>（setup なし）ブロック */
  script: SfcBlock | null;

  /** <script setup> ブロック */
  scriptSetup: SfcBlock | null;

  /** <style> ブロック（複数可） */
  styles: SfcBlock[];

  /** カスタムブロック（<docs> など） */
  customBlocks: SfcBlock[];
}
```

### SFC パーサー

`.vue` ファイルをパースして `SfcDescriptor` を生成します．

::: tip
実際の実装では，chibivue に実装済みの `@chibivue/compiler-sfc` パッケージの `parse` 関数を使用できます．ここでは教育目的で簡略化したパーサーを示します．
:::

```ts
// parseSfc.ts
import type { SfcBlock, SfcDescriptor } from './types';

/**
 * .vue ファイルの内容をパースして SfcDescriptor を返す
 *
 * @param content - .vue ファイルの内容
 * @param fileName - ファイル名（エラーメッセージ用）
 */
export function parseSfc(content: string, fileName: string): SfcDescriptor {
  const descriptor: SfcDescriptor = {
    template: null,
    script: null,
    scriptSetup: null,
    styles: [],
    customBlocks: [],
  };

  // トップレベルのブロックにマッチする正規表現
  // <tagName attrs>content</tagName> の形式を検出
  const blockRegex = /<(\w+)([^>]*)>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(content)) !== null) {
    const [fullMatch, tagName, attrsString, blockContent] = match;

    // ブロックの開始位置を計算
    const startOffset = match.index + `<${tagName}${attrsString}>`.length;
    const startPos = offsetToPosition(content, startOffset);

    // ブロックの終了位置を計算
    const endOffset = startOffset + blockContent.length;
    const endPos = offsetToPosition(content, endOffset);

    // 属性をパース（例："lang="ts" scoped" → { lang: "ts", scoped: true }）
    const attrs = parseAttrs(attrsString);

    const block: SfcBlock = {
      type: tagName,
      content: blockContent,
      loc: {
        start: { ...startPos, offset: startOffset },
        end: { ...endPos, offset: endOffset },
      },
      attrs,
      lang: typeof attrs.lang === 'string' ? attrs.lang : undefined,
    };

    // ブロックの種類に応じて振り分け
    switch (tagName) {
      case 'template':
        descriptor.template = block;
        break;
      case 'script':
        // setup 属性の有無で振り分け
        if ('setup' in attrs) {
          descriptor.scriptSetup = block;
        } else {
          descriptor.script = block;
        }
        break;
      case 'style':
        descriptor.styles.push(block);
        break;
      default:
        descriptor.customBlocks.push(block);
    }
  }

  return descriptor;
}

/**
 * オフセット（文字位置）から行・列番号を計算
 */
function offsetToPosition(
  content: string,
  offset: number
): { line: number; column: number } {
  const lines = content.slice(0, offset).split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

/**
 * 属性文字列をパースしてオブジェクトに変換
 * 例: ' lang="ts" scoped' → { lang: "ts", scoped: true }
 */
function parseAttrs(attrsString: string): Record<string, string | true> {
  const attrs: Record<string, string | true> = {};
  const attrRegex = /(\w+)(?:="([^"]*)"|='([^']*)')?/g;
  let attrMatch: RegExpExecArray | null;

  while ((attrMatch = attrRegex.exec(attrsString)) !== null) {
    const [, name, doubleQuoted, singleQuoted] = attrMatch;
    attrs[name] = doubleQuoted ?? singleQuoted ?? true;
  }

  return attrs;
}
```

### 仮想コード生成

Volar.js の `VirtualCode` インターフェースを実装します．これが Language Tools の心臓部です．

```ts
// virtualCode.ts
import type {
  CodeMapping,
  VirtualCode,
} from '@volar/language-core';
import type * as ts from 'typescript';
import { parseSfc } from './parseSfc';
import type { SfcDescriptor } from './types';

/**
 * コードセグメント：生成コードの一部とそのマッピング情報
 */
type CodeSegment = [
  code: string,                           // 生成するコード
  sourceOffsetStart?: number,             // 元ファイルでの開始位置
  sourceOffsetEnd?: number,               // 元ファイルでの終了位置
  features?: { verification?: boolean },  // マッピングの機能設定
];

/**
 * .vue ファイルを仮想 TypeScript コードに変換するクラス
 */
export class ChibivueVirtualCode implements VirtualCode {
  id = 'root';
  languageId = 'vue';
  snapshot: ts.IScriptSnapshot;
  mappings: CodeMapping[] = [];
  embeddedCodes: VirtualCode[] = [];

  private fileName: string;
  private sfc: SfcDescriptor;

  constructor(fileName: string, snapshot: ts.IScriptSnapshot) {
    this.fileName = fileName;
    this.snapshot = snapshot;
    const content = snapshot.getText(0, snapshot.getLength());
    this.sfc = parseSfc(content, fileName);
    this.generateVirtualCode(content);
  }

  /**
   * ファイルが更新されたときに呼ばれる
   */
  update(snapshot: ts.IScriptSnapshot): void {
    this.snapshot = snapshot;
    const content = snapshot.getText(0, snapshot.getLength());
    this.sfc = parseSfc(content, this.fileName);
    this.generateVirtualCode(content);
  }

  /**
   * 仮想コードを生成するメイン処理
   */
  private generateVirtualCode(sourceContent: string): void {
    const segments: CodeSegment[] = [];

    // 1. script/scriptSetup のコードを生成
    this.generateScriptCode(segments);

    // 2. テンプレートの型チェックコードを生成
    this.generateTemplateCode(segments);

    // 3. セグメントから最終的なコードとマッピングを構築
    const { code, mappings } = this.buildCode(segments, sourceContent);

    // 4. 埋め込みコード（TypeScript）として登録
    this.embeddedCodes = [
      {
        id: 'ts',
        languageId: 'typescript',
        snapshot: createScriptSnapshot(code),
        mappings,
        embeddedCodes: [],
      },
    ];
  }

  /**
   * script/scriptSetup ブロックから TypeScript コードを生成
   */
  private generateScriptCode(segments: CodeSegment[]): void {
    const { script, scriptSetup } = this.sfc;

    if (scriptSetup) {
      // <script setup> の内容をそのまま出力
      // マッピング情報も追加（元ファイルの位置と対応付け）
      segments.push([
        scriptSetup.content,
        scriptSetup.loc.start.offset,
        scriptSetup.loc.end.offset,
        { verification: true },
      ]);
      segments.push(['\n']);
    } else if (script) {
      // <script> の内容をそのまま出力
      segments.push([
        script.content,
        script.loc.start.offset,
        script.loc.end.offset,
        { verification: true },
      ]);
      segments.push(['\n']);
    }
  }

  /**
   * テンプレート内の式を型チェックするためのコードを生成
   */
  private generateTemplateCode(segments: CodeSegment[]): void {
    const { template } = this.sfc;
    if (!template) return;

    // テンプレート型チェック用のコードを追加
    segments.push(['\n// Template type-checking\n']);
    segments.push(['declare const __VLS_template: () => void;\n']);

    // マスタッシュ式 {{ expr }} を検出
    const mustacheRegex = /\{\{\s*([\s\S]*?)\s*\}\}/g;
    let match: RegExpExecArray | null;
    let exprIndex = 0;

    while ((match = mustacheRegex.exec(template.content)) !== null) {
      const expr = match[1];
      // 元ファイルでの式の位置を計算
      const exprStartInTemplate = match.index + match[0].indexOf(expr);
      const sourceStart = template.loc.start.offset + exprStartInTemplate;
      const sourceEnd = sourceStart + expr.length;

      // 式を検証するコードを生成
      // (() => { const __VLS_expr0 = (message); })();
      segments.push([`(() => {\n  const __VLS_expr${exprIndex} = (`]);
      segments.push([
        expr,
        sourceStart,
        sourceEnd,
        { verification: true },
      ]);
      segments.push([');\n})();\n']);

      exprIndex++;
    }
  }

  /**
   * セグメントから最終的なコードとマッピングを構築
   */
  private buildCode(
    segments: CodeSegment[],
    sourceContent: string
  ): { code: string; mappings: CodeMapping[] } {
    let code = '';
    const mappings: CodeMapping[] = [];

    for (const segment of segments) {
      const [text, sourceStart, sourceEnd, features] = segment;

      if (sourceStart !== undefined && sourceEnd !== undefined) {
        // マッピング情報がある場合，記録する
        mappings.push({
          sourceOffsets: [sourceStart],
          generatedOffsets: [code.length],
          lengths: [sourceEnd - sourceStart],
          data: {
            verification: features?.verification ?? false,
            completion: true,
            semantic: true,
            navigation: true,
            structure: true,
            format: false,
          },
        });
      }

      code += text;
    }

    return { code, mappings };
  }
}

/**
 * TypeScript のスクリプトスナップショットを作成
 */
function createScriptSnapshot(content: string): ts.IScriptSnapshot {
  return {
    getText: (start, end) => content.slice(start, end),
    getLength: () => content.length,
    getChangeRange: () => undefined,
  };
}
```

### 言語プラグイン

Volar.js に `.vue` ファイルの処理方法を伝えるプラグインを実装します．

```ts
// languagePlugin.ts
import type { LanguagePlugin } from '@volar/language-core';
import { ChibivueVirtualCode } from './virtualCode';

/**
 * Volar.js 用の言語プラグインを作成
 *
 * このプラグインは以下の役割を担います：
 * 1. .vue ファイルを識別する
 * 2. .vue ファイルから仮想コードを生成する
 * 3. TypeScript 言語サービスに仮想コードを提供する
 */
export function createChibivueLanguagePlugin(): LanguagePlugin<
  string,
  ChibivueVirtualCode
> {
  return {
    /**
     * ファイル拡張子から言語 ID を判定
     * .vue ファイルの場合 "vue" を返す
     */
    getLanguageId(scriptId: string): string | undefined {
      if (scriptId.endsWith('.vue')) {
        return 'vue';
      }
      return undefined;
    },

    /**
     * 仮想コードを新規作成
     * ファイルが初めて開かれたときに呼ばれる
     */
    createVirtualCode(scriptId, languageId, snapshot) {
      if (languageId === 'vue') {
        return new ChibivueVirtualCode(scriptId, snapshot);
      }
      return undefined;
    },

    /**
     * 既存の仮想コードを更新
     * ファイルが編集されたときに呼ばれる
     */
    updateVirtualCode(_scriptId, virtualCode, snapshot) {
      virtualCode.update(snapshot);
      return virtualCode;
    },

    /**
     * TypeScript 固有の設定
     */
    typescript: {
      /**
       * TypeScript に .vue ファイルを認識させる設定
       *
       * - extension: 対象のファイル拡張子
       * - isMixedContent: 複数の言語が含まれることを示す
       * - scriptKind: TypeScript の ScriptKind
       *   - 7 = Deferred（遅延評価，仮想コードを使用）
       */
      extraFileExtensions: [
        { extension: 'vue', isMixedContent: true, scriptKind: 7 },
      ],

      /**
       * 仮想コードから TypeScript に渡すスクリプトを取得
       *
       * @returns
       *   - code: 埋め込みの TypeScript コード
       *   - extension: ".ts"（TypeScript として扱う）
       *   - scriptKind: 3 = TS（通常の TypeScript）
       */
      getServiceScript(rootVirtualCode) {
        for (const code of rootVirtualCode.embeddedCodes) {
          if (code.id === 'ts') {
            return {
              code,
              extension: '.ts',
              scriptKind: 3, // ts.ScriptKind.TS
            };
          }
        }
        return undefined;
      },
    },
  };
}
```

### 言語サーバー

LSP（Language Server Protocol）サーバーは，エディタと言語機能を橋渡しします．

```ts
// server.ts
import {
  createConnection,
  createServer,
  createSimpleProjectProviderFactory,
  loadTsdkByPath,
} from '@volar/language-server/node';
import { create as createTypeScriptServices } from 'volar-service-typescript';
import { createChibivueLanguagePlugin } from '@chibivue/language-core';

/**
 * LSP (Language Server Protocol) について
 *
 * LSP はエディタと言語機能を分離するためのプロトコルです．
 *
 * ┌──────────┐                        ┌──────────────────┐
 * │  VSCode  │ ◄───── LSP 通信 ─────► │  Language Server │
 * │  Neovim  │    (JSON-RPC over      │  (このファイル)  │
 * │  Emacs   │     stdio/IPC)         │                  │
 * └──────────┘                        └──────────────────┘
 *
 * LSP の主なリクエスト：
 * - textDocument/completion: 自動補完候補の取得
 * - textDocument/hover: ホバー情報の取得
 * - textDocument/definition: 定義へ移動
 * - textDocument/references: 参照の検索
 * - textDocument/rename: シンボルのリネーム
 * - textDocument/diagnostics: エラー診断
 */

// LSP 接続を作成（stdin/stdout または IPC で通信）
const connection = createConnection();

// Volar の言語サーバーを作成
const server = createServer(connection);

// 接続のリスニングを開始
connection.listen();

/**
 * 初期化リクエストのハンドラ
 * クライアント（エディタ）が接続したときに呼ばれる
 */
connection.onInitialize((params) => {
  // TypeScript SDK のパスを取得（クライアントから渡される）
  const tsdk = params.initializationOptions?.typescript?.tsdk;

  // TypeScript モジュールをロード
  const ts = tsdk
    ? loadTsdkByPath(tsdk, params.locale)
    : require('typescript');

  // chibivue 言語プラグインを作成
  const chibivuePlugin = createChibivueLanguagePlugin();

  // サーバーを初期化して機能を登録
  return server.initialize(
    params,
    // プロジェクト管理の設定（tsconfig.json の検出など）
    createSimpleProjectProviderFactory(),
    {
      /**
       * 言語プラグインを返す
       * .vue ファイルの仮想コード生成を担当
       */
      getLanguagePlugins() {
        return [chibivuePlugin];
      },

      /**
       * サービスプラグインを返す
       * TypeScript の言語機能（補完，診断など）を提供
       */
      getServicePlugins() {
        return [...createTypeScriptServices(ts)];
      },
    }
  );
});

/**
 * 初期化完了のハンドラ
 */
connection.onInitialized(() => {
  // 必要に応じて追加の設定を行う
});
```

### VSCode 拡張機能

VSCode と言語サーバーを接続する拡張機能を実装します．

```ts
// extension.ts
import * as path from 'path';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

/**
 * 拡張機能のアクティベーション
 * .vue ファイルを開いたときに自動的に呼ばれる
 */
export async function activate(context: vscode.ExtensionContext) {
  // 言語サーバーのパスを解決
  const serverPath = context.asAbsolutePath(
    path.join('dist', 'server.js')
  );

  // サーバーの起動オプション
  const serverOptions: ServerOptions = {
    run: {
      module: serverPath,
      transport: TransportKind.ipc, // IPC で通信
    },
    debug: {
      module: serverPath,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6009'] },
    },
  };

  // クライアントのオプション
  const clientOptions: LanguageClientOptions = {
    // どのファイルを処理するか
    documentSelector: [{ scheme: 'file', language: 'vue' }],

    // 初期化時にサーバーに渡すオプション
    initializationOptions: {
      typescript: {
        // VSCode 内蔵の TypeScript SDK を使用
        tsdk: path.join(
          vscode.env.appRoot,
          'extensions/node_modules/typescript/lib'
        ),
      },
    },
  };

  // Language Client を作成
  client = new LanguageClient(
    'chibivue',                    // クライアント ID
    'Chibivue Language Server',   // 表示名
    serverOptions,
    clientOptions
  );

  // 言語サーバーを起動
  await client.start();

  // 拡張機能の非アクティベーション時にクリーンアップ
  context.subscriptions.push({
    dispose: () => client?.stop(),
  });
}

/**
 * 拡張機能の非アクティベーション
 */
export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
```

### シンタックスハイライト（TextMate 文法）

シンタックスハイライトは TextMate 文法で定義します．これは VSCode の組み込み機能を使用し，言語サーバーは関与しません．

```json
// syntaxes/vue.tmLanguage.json
{
  "name": "Vue",
  "scopeName": "source.vue",
  "patterns": [
    { "include": "#template" },
    { "include": "#script" },
    { "include": "#style" }
  ],
  "repository": {
    "template": {
      "begin": "(<)(template)",
      "end": "(</)(template)(>)",
      "patterns": [{ "include": "text.html.basic" }]
    },
    "script": {
      "begin": "(<)(script)",
      "end": "(</)(script)(>)",
      "patterns": [{ "include": "source.ts" }]
    },
    "style": {
      "begin": "(<)(style)",
      "end": "(</)(style)(>)",
      "patterns": [{ "include": "source.css" }]
    }
  }
}
```

## サポートされている機能

| 機能                   | ステータス   | 説明                                           |
| ---------------------- | ------------ | ---------------------------------------------- |
| シンタックスハイライト | サポート済み | TextMate 文法による色分け                      |
| 自動補完               | サポート済み | 変数，関数，プロパティの補完                   |
| 型チェック             | サポート済み | TypeScript による型エラーの検出                |
| 定義へ移動             | サポート済み | 変数や関数の定義位置へジャンプ                 |
| エラー診断             | サポート済み | 構文エラー，型エラーの表示                     |
| シンボルリネーム       | サポート済み | 変数名などの一括変更                           |
| ホバー情報             | サポート済み | カーソル位置の型情報を表示                     |

## まとめ

Language Tools は `.vue` ファイルを仮想 TypeScript コードに変換することで，TypeScript の全機能を SFC で利用可能にします．

**主要なコンポーネント：**

1. **SFC パーサー** - `.vue` ファイルを template，script，style ブロックに分解
2. **仮想コード生成** - SFC を TypeScript に変換し，コードマッピングを生成
3. **言語プラグイン** - Volar.js のインターフェースを実装し，仮想コードを提供
4. **言語サーバー** - LSP を通じてエディタと通信
5. **VSCode 拡張機能** - VSCode と言語サーバーを接続

この実装は教育目的の最小限のものです．本番環境で使用される [vuejs/language-tools](https://github.com/vuejs/language-tools) では，以下のような高度な機能が追加されています：

- テンプレート内のディレクティブ（`v-if`，`v-for` など）の型チェック
- コンポーネント props の型検証
- `<style scoped>` のセレクタ補完
- `<template>` 内の HTML 補完
- マクロ（`defineProps`，`defineEmits`）のサポート
