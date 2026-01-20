# Language Tools

## 什麼是 Language Tools？

Language Tools 為 `.vue` 單文件組件（SFCs）提供 IDE 支援．它們啟用以下功能：

- 語法高亮
- 自動補全
- 類型檢查
- 轉到定義
- 錯誤診斷

在 Vue.js 生態系統中，[vuejs/language-tools](https://github.com/vuejs/language-tools) 提供此功能，它基於 [Volar.js](https://volarjs.dev/) 構建．在本章中，我們將使用 Volar.js 為 chibivue 實現最小化的語言工具．

## 為什麼需要 Language Tools？

TypeScript 的語言服務只能理解 `.ts` 和 `.tsx` 檔案．然而 `.vue` 檔案包含多種語言混合在一起：

```vue
<template>
  <div>{{ message }}</div>  <!-- HTML + 表達式 -->
</template>

<script setup lang="ts">
const message = ref('Hello')  // TypeScript
</script>

<style scoped>
div { color: red; }  /* CSS */
</style>
```

Language Tools 的作用是將這種複合檔案**轉換**為 TypeScript 語言服務可以理解的格式．通過這種轉換，在 `.vue` 檔案中也可以使用 TypeScript 的所有功能（類型檢查，自動補全，重構等）．

## 架構概述

語言工具由三個主要套件組成：

```txt
@extensions/
├── chibivue-language-core/     # 核心語言處理
│   ├── parseSfc.ts             # SFC 解析器
│   ├── virtualCode.ts          # 虛擬代碼生成
│   ├── languagePlugin.ts       # Volar.js 插件
│   └── types.ts                # 類型定義
├── chibivue-language-server/   # LSP 伺服器
│   └── server.ts               # 語言伺服器協議伺服器
└── vscode-chibivue/            # VSCode 擴充功能
    ├── extension.ts            # 擴充功能入口點
    ├── syntaxes/               # TextMate 語法
    └── language-configuration.json
```

### 資料流

當你在編輯器中編輯 `.vue` 檔案時，資料按以下流程處理：

```txt
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VSCode                                         │
│  ┌─────────────┐                                                            │
│  │  App.vue    │  用戶編輯 .vue 檔案                                        │
│  └──────┬──────┘                                                            │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────┐                                                    │
│  │  vscode-chibivue    │  VSCode 擴充功能檢測檔案變化                       │
│  │  (Language Client)  │                                                    │
│  └──────────┬──────────┘                                                    │
└─────────────┼───────────────────────────────────────────────────────────────┘
              │ LSP (Language Server Protocol)
              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  chibivue-language-server                                                   │
│  ┌─────────────────────┐                                                    │
│  │  Language Server    │  接收 LSP 請求                                     │
│  └──────────┬──────────┘                                                    │
│             │                                                               │
│             ▼                                                               │
│  ┌─────────────────────┐    ┌─────────────────────┐                         │
│  │  chibivue-language  │───▶│  Virtual Code       │                         │
│  │  -core (Plugin)     │    │  (.vue → .ts 轉換)  │                         │
│  └─────────────────────┘    └──────────┬──────────┘                         │
│                                        │                                    │
│                                        ▼                                    │
│                             ┌─────────────────────┐                         │
│                             │  TypeScript         │                         │
│                             │  Language Service   │  類型檢查、補全等       │
│                             └──────────┬──────────┘                         │
│                                        │                                    │
│                                        ▼                                    │
│                             ┌─────────────────────┐                         │
│                             │  Code Mappings      │  將結果映射回原位置     │
│                             └─────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 核心概念

### 虛擬代碼 (Virtual Code)

Language Tools 的核心概念是**虛擬代碼**．通過將 `.vue` 檔案轉換為 TypeScript，可以利用 TypeScript 語言服務的所有功能．

#### 轉換示例

```vue
<!-- 原始 .vue 檔案 -->
<template>
  <div>{{ message }}</div>
</template>

<script setup lang="ts">
import { ref } from 'chibivue'

const message = ref('Hello')
</script>
```

這會被轉換為以下虛擬 TypeScript：

```ts
// 虛擬 TypeScript 代碼
import { ref } from 'chibivue'

const message = ref('Hello')

// 用於類型檢查模板表達式的代碼
// 實際上不會執行，但允許 TypeScript 驗證表達式類型
declare const __VLS_template: () => void;
(() => {
  // 對應模板中的 {{ message }}
  // TypeScript 驗證 message 是否存在且類型正確
  const __VLS_expr0 = (message);
})();
```

通過這種轉換：
- 可以驗證 `message` 的類型是 `Ref<string>`
- 如果 `message` 未定義，會報告錯誤
- 懸停在 `message` 上時會顯示類型資訊

### 代碼映射

**代碼映射**將虛擬代碼中的位置連結回原始 `.vue` 檔案的位置．

```txt
原始 .vue 檔案                        虛擬 TypeScript
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
                                映射將位置連結在一起
```

有了映射：
- 虛擬代碼中的錯誤 → 在原始 `.vue` 檔案的正確位置顯示
- 執行「轉到定義」→ 將虛擬代碼的位置轉換為原始檔案的位置

## 實現

### 類型定義

首先，定義表示 SFC 結構的類型．

```ts
// types.ts

/**
 * 表示 SFC 中的每個區塊（template、script、style）
 */
export interface SfcBlock {
  /** 區塊類型（"template"、"script"、"style" 等） */
  type: string;

  /** 區塊內容（不包括標籤的內部內容） */
  content: string;

  /** 位置資訊（用於錯誤顯示和映射） */
  loc: {
    start: { line: number; column: number; offset: number };
    end: { line: number; column: number; offset: number };
  };

  /** 區塊屬性（例如：lang="ts"、scoped） */
  attrs: Record<string, string | true>;

  /** 語言指定（attrs.lang 的快捷方式） */
  lang?: string;
}

/**
 * 表示解析後的整個 SFC
 */
export interface SfcDescriptor {
  /** <template> 區塊 */
  template: SfcBlock | null;

  /** <script>（不帶 setup）區塊 */
  script: SfcBlock | null;

  /** <script setup> 區塊 */
  scriptSetup: SfcBlock | null;

  /** <style> 區塊（可以有多個） */
  styles: SfcBlock[];

  /** 自定義區塊（例如：<docs>） */
  customBlocks: SfcBlock[];
}
```

### SFC 解析器

解析 `.vue` 檔案以生成 `SfcDescriptor`．

::: tip
在實際實現中，可以使用 chibivue 的 `@chibivue/compiler-sfc` 套件中的 `parse` 函數．這裡為了教育目的展示一個簡化的解析器．
:::

```ts
// parseSfc.ts
import type { SfcBlock, SfcDescriptor } from './types';

/**
 * 解析 .vue 檔案內容並返回 SfcDescriptor
 *
 * @param content - .vue 檔案的內容
 * @param fileName - 檔案名（用於錯誤訊息）
 */
export function parseSfc(content: string, fileName: string): SfcDescriptor {
  const descriptor: SfcDescriptor = {
    template: null,
    script: null,
    scriptSetup: null,
    styles: [],
    customBlocks: [],
  };

  // 匹配頂級區塊的正規表達式
  // 檢測 <tagName attrs>content</tagName> 格式
  const blockRegex = /<(\w+)([^>]*)>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(content)) !== null) {
    const [fullMatch, tagName, attrsString, blockContent] = match;

    // 計算區塊的起始位置
    const startOffset = match.index + `<${tagName}${attrsString}>`.length;
    const startPos = offsetToPosition(content, startOffset);

    // 計算區塊的結束位置
    const endOffset = startOffset + blockContent.length;
    const endPos = offsetToPosition(content, endOffset);

    // 解析屬性（例如：'lang="ts" scoped' → { lang: "ts", scoped: true }）
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

    // 按區塊類型分類
    switch (tagName) {
      case 'template':
        descriptor.template = block;
        break;
      case 'script':
        // 根據是否有 setup 屬性分類
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
 * 從偏移量（字元位置）計算行號和列號
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
 * 解析屬性字串為物件
 * 示例：' lang="ts" scoped' → { lang: "ts", scoped: true }
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

### 虛擬代碼生成

實現 Volar.js 的 `VirtualCode` 介面．這是 Language Tools 的核心．

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
 * 代碼段：生成代碼的一部分及其映射資訊
 */
type CodeSegment = [
  code: string,                           // 要生成的代碼
  sourceOffsetStart?: number,             // 源檔案中的起始位置
  sourceOffsetEnd?: number,               // 源檔案中的結束位置
  features?: { verification?: boolean },  // 映射功能設置
];

/**
 * 將 .vue 檔案轉換為虛擬 TypeScript 代碼的類
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
   * 檔案更新時調用
   */
  update(snapshot: ts.IScriptSnapshot): void {
    this.snapshot = snapshot;
    const content = snapshot.getText(0, snapshot.getLength());
    this.sfc = parseSfc(content, this.fileName);
    this.generateVirtualCode(content);
  }

  /**
   * 生成虛擬代碼的主處理
   */
  private generateVirtualCode(sourceContent: string): void {
    const segments: CodeSegment[] = [];

    // 1. 從 script/scriptSetup 生成代碼
    this.generateScriptCode(segments);

    // 2. 生成模板類型檢查代碼
    this.generateTemplateCode(segments);

    // 3. 從段構建最終代碼和映射
    const { code, mappings } = this.buildCode(segments, sourceContent);

    // 4. 註冊為嵌入代碼（TypeScript）
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
   * 從 script/scriptSetup 區塊生成 TypeScript 代碼
   */
  private generateScriptCode(segments: CodeSegment[]): void {
    const { script, scriptSetup } = this.sfc;

    if (scriptSetup) {
      // 原樣輸出 <script setup> 內容
      // 添加映射資訊（連結到源檔案位置）
      segments.push([
        scriptSetup.content,
        scriptSetup.loc.start.offset,
        scriptSetup.loc.end.offset,
        { verification: true },
      ]);
      segments.push(['\n']);
    } else if (script) {
      // 原樣輸出 <script> 內容
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
   * 生成用於類型檢查模板表達式的代碼
   */
  private generateTemplateCode(segments: CodeSegment[]): void {
    const { template } = this.sfc;
    if (!template) return;

    // 添加模板類型檢查代碼
    segments.push(['\n// Template type-checking\n']);
    segments.push(['declare const __VLS_template: () => void;\n']);

    // 檢測 mustache 表達式 {{ expr }}
    const mustacheRegex = /\{\{\s*([\s\S]*?)\s*\}\}/g;
    let match: RegExpExecArray | null;
    let exprIndex = 0;

    while ((match = mustacheRegex.exec(template.content)) !== null) {
      const expr = match[1];
      // 計算表達式在源檔案中的位置
      const exprStartInTemplate = match.index + match[0].indexOf(expr);
      const sourceStart = template.loc.start.offset + exprStartInTemplate;
      const sourceEnd = sourceStart + expr.length;

      // 生成驗證表達式的代碼
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
   * 從段構建最終代碼和映射
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
        // 存在映射資訊時記錄
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
 * 建立 TypeScript 腳本快照
 */
function createScriptSnapshot(content: string): ts.IScriptSnapshot {
  return {
    getText: (start, end) => content.slice(start, end),
    getLength: () => content.length,
    getChangeRange: () => undefined,
  };
}
```

### 語言插件

實現告訴 Volar.js 如何處理 `.vue` 檔案的插件．

```ts
// languagePlugin.ts
import type { LanguagePlugin } from '@volar/language-core';
import { ChibivueVirtualCode } from './virtualCode';

/**
 * 為 Volar.js 建立語言插件
 *
 * 此插件負責：
 * 1. 識別 .vue 檔案
 * 2. 從 .vue 檔案生成虛擬代碼
 * 3. 向 TypeScript 語言服務提供虛擬代碼
 */
export function createChibivueLanguagePlugin(): LanguagePlugin<
  string,
  ChibivueVirtualCode
> {
  return {
    /**
     * 從檔案擴展名判斷語言 ID
     * 對於 .vue 檔案返回 "vue"
     */
    getLanguageId(scriptId: string): string | undefined {
      if (scriptId.endsWith('.vue')) {
        return 'vue';
      }
      return undefined;
    },

    /**
     * 建立新的虛擬代碼
     * 首次打開檔案時調用
     */
    createVirtualCode(scriptId, languageId, snapshot) {
      if (languageId === 'vue') {
        return new ChibivueVirtualCode(scriptId, snapshot);
      }
      return undefined;
    },

    /**
     * 更新現有的虛擬代碼
     * 編輯檔案時調用
     */
    updateVirtualCode(_scriptId, virtualCode, snapshot) {
      virtualCode.update(snapshot);
      return virtualCode;
    },

    /**
     * TypeScript 特定設置
     */
    typescript: {
      /**
       * 使 TypeScript 識別 .vue 檔案的設置
       *
       * - extension: 目標檔案擴展名
       * - isMixedContent: 表示包含多種語言
       * - scriptKind: TypeScript 的 ScriptKind
       *   - 7 = Deferred（延遲評估，使用虛擬代碼）
       */
      extraFileExtensions: [
        { extension: 'vue', isMixedContent: true, scriptKind: 7 },
      ],

      /**
       * 從虛擬代碼獲取要傳遞給 TypeScript 的腳本
       *
       * @returns
       *   - code: 嵌入的 TypeScript 代碼
       *   - extension: ".ts"（作為 TypeScript 處理）
       *   - scriptKind: 3 = TS（普通 TypeScript）
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

### 語言伺服器

LSP（語言伺服器協議）伺服器連接編輯器和語言功能．

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
 * 關於 LSP（語言伺服器協議）
 *
 * LSP 是將編輯器與語言功能分離的協議．
 *
 * ┌──────────┐                        ┌──────────────────┐
 * │  VSCode  │ ◄───── LSP 通訊 ─────► │  Language Server │
 * │  Neovim  │    (JSON-RPC over      │  （此檔案）      │
 * │  Emacs   │     stdio/IPC)         │                  │
 * └──────────┘                        └──────────────────┘
 *
 * 主要 LSP 請求：
 * - textDocument/completion: 獲取自動補全候選
 * - textDocument/hover: 獲取懸停資訊
 * - textDocument/definition: 轉到定義
 * - textDocument/references: 查找引用
 * - textDocument/rename: 重新命名符號
 * - textDocument/diagnostics: 錯誤診斷
 */

// 建立 LSP 連接（通過 stdin/stdout 或 IPC 通訊）
const connection = createConnection();

// 建立 Volar 語言伺服器
const server = createServer(connection);

// 開始監聽連接
connection.listen();

/**
 * 初始化請求的處理程序
 * 客戶端（編輯器）連接時調用
 */
connection.onInitialize((params) => {
  // 獲取 TypeScript SDK 路徑（從客戶端傳遞）
  const tsdk = params.initializationOptions?.typescript?.tsdk;

  // 載入 TypeScript 模組
  const ts = tsdk
    ? loadTsdkByPath(tsdk, params.locale)
    : require('typescript');

  // 建立 chibivue 語言插件
  const chibivuePlugin = createChibivueLanguagePlugin();

  // 初始化伺服器並註冊功能
  return server.initialize(
    params,
    // 專案管理設置（tsconfig.json 檢測等）
    createSimpleProjectProviderFactory(),
    {
      /**
       * 返回語言插件
       * 負責從 .vue 檔案生成虛擬代碼
       */
      getLanguagePlugins() {
        return [chibivuePlugin];
      },

      /**
       * 返回服務插件
       * 提供 TypeScript 語言功能（補全、診斷等）
       */
      getServicePlugins() {
        return [...createTypeScriptServices(ts)];
      },
    }
  );
});

/**
 * 初始化完成的處理程序
 */
connection.onInitialized(() => {
  // 根據需要進行額外設置
});
```

### VSCode 擴充功能

實現將 VSCode 連接到語言伺服器的擴充功能．

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
 * 擴充功能啟動
 * 打開 .vue 檔案時自動調用
 */
export async function activate(context: vscode.ExtensionContext) {
  // 解析語言伺服器路徑
  const serverPath = context.asAbsolutePath(
    path.join('dist', 'server.js')
  );

  // 伺服器啟動選項
  const serverOptions: ServerOptions = {
    run: {
      module: serverPath,
      transport: TransportKind.ipc, // 通過 IPC 通訊
    },
    debug: {
      module: serverPath,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6009'] },
    },
  };

  // 客戶端選項
  const clientOptions: LanguageClientOptions = {
    // 處理哪些檔案
    documentSelector: [{ scheme: 'file', language: 'vue' }],

    // 初始化時傳遞給伺服器的選項
    initializationOptions: {
      typescript: {
        // 使用 VSCode 內建的 TypeScript SDK
        tsdk: path.join(
          vscode.env.appRoot,
          'extensions/node_modules/typescript/lib'
        ),
      },
    },
  };

  // 建立 Language Client
  client = new LanguageClient(
    'chibivue',                    // 客戶端 ID
    'Chibivue Language Server',   // 顯示名稱
    serverOptions,
    clientOptions
  );

  // 啟動語言伺服器
  await client.start();

  // 擴充功能停用時清理
  context.subscriptions.push({
    dispose: () => client?.stop(),
  });
}

/**
 * 擴充功能停用
 */
export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
```

### 語法高亮（TextMate 語法）

語法高亮使用 TextMate 語法定義．這使用 VSCode 的內建功能，不涉及語言伺服器．

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

## 支援的功能

| 功能           | 狀態   | 描述                           |
| -------------- | ------ | ------------------------------ |
| 語法高亮       | 已支援 | 通過 TextMate 語法進行顏色編碼 |
| 自動補全       | 已支援 | 變數，函數，屬性補全           |
| 類型檢查       | 已支援 | 通過 TypeScript 檢測類型錯誤   |
| 轉到定義       | 已支援 | 跳轉到變數/函數定義            |
| 錯誤診斷       | 已支援 | 顯示語法和類型錯誤             |
| 重新命名符號   | 已支援 | 批量重新命名變數等             |
| 懸停資訊       | 已支援 | 顯示游標位置的類型資訊         |

## 總結

Language Tools 通過將 `.vue` 檔案轉換為虛擬 TypeScript 代碼，使 SFC 中可以使用 TypeScript 的所有功能．

**主要組件：**

1. **SFC 解析器** - 將 `.vue` 檔案分解為 template，script 和 style 區塊
2. **虛擬代碼生成** - 將 SFC 轉換為帶有代碼映射的 TypeScript
3. **語言插件** - 實現 Volar.js 介面以提供虛擬代碼
4. **語言伺服器** - 通過 LSP 與編輯器通訊
5. **VSCode 擴充功能** - 將 VSCode 連接到語言伺服器

此實現是用於教育目的的最小實現．生產環境使用的 [vuejs/language-tools](https://github.com/vuejs/language-tools) 添加了許多高級功能：

- 模板指令（`v-if`，`v-for` 等）的類型檢查
- 組件 props 類型驗證
- `<style scoped>` 選擇器補全
- `<template>` 中的 HTML 補全
- 巨集支援（`defineProps`，`defineEmits`）
