# Language Tools

## 什么是 Language Tools？

Language Tools 为 `.vue` 单文件组件（SFCs）提供 IDE 支持．它们启用以下功能：

- 语法高亮
- 自动补全
- 类型检查
- 转到定义
- 错误诊断

在 Vue.js 生态系统中，[vuejs/language-tools](https://github.com/vuejs/language-tools) 提供此功能，它基于 [Volar.js](https://volarjs.dev/) 构建．在本章中，我们将使用 Volar.js 为 chibivue 实现最小化的语言工具．

## 为什么需要 Language Tools？

TypeScript 的语言服务只能理解 `.ts` 和 `.tsx` 文件．然而 `.vue` 文件包含多种语言混合在一起：

```vue
<template>
  <div>{{ message }}</div>  <!-- HTML + 表达式 -->
</template>

<script setup lang="ts">
const message = ref('Hello')  // TypeScript
</script>

<style scoped>
div { color: red; }  /* CSS */
</style>
```

Language Tools 的作用是将这种复合文件**转换**为 TypeScript 语言服务可以理解的格式．通过这种转换，在 `.vue` 文件中也可以使用 TypeScript 的所有功能（类型检查，自动补全，重构等）．

## 架构概述

语言工具由三个主要包组成：

```txt
@extensions/
├── chibivue-language-core/     # 核心语言处理
│   ├── parseSfc.ts             # SFC 解析器
│   ├── virtualCode.ts          # 虚拟代码生成
│   ├── languagePlugin.ts       # Volar.js 插件
│   └── types.ts                # 类型定义
├── chibivue-language-server/   # LSP 服务器
│   └── server.ts               # 语言服务器协议服务器
└── vscode-chibivue/            # VSCode 扩展
    ├── extension.ts            # 扩展入口点
    ├── syntaxes/               # TextMate 语法
    └── language-configuration.json
```

### 数据流

当你在编辑器中编辑 `.vue` 文件时，数据按以下流程处理：

```txt
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VSCode                                         │
│  ┌─────────────┐                                                            │
│  │  App.vue    │  用户编辑 .vue 文件                                        │
│  └──────┬──────┘                                                            │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────┐                                                    │
│  │  vscode-chibivue    │  VSCode 扩展检测文件变化                           │
│  │  (Language Client)  │                                                    │
│  └──────────┬──────────┘                                                    │
└─────────────┼───────────────────────────────────────────────────────────────┘
              │ LSP (Language Server Protocol)
              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  chibivue-language-server                                                   │
│  ┌─────────────────────┐                                                    │
│  │  Language Server    │  接收 LSP 请求                                     │
│  └──────────┬──────────┘                                                    │
│             │                                                               │
│             ▼                                                               │
│  ┌─────────────────────┐    ┌─────────────────────┐                         │
│  │  chibivue-language  │───▶│  Virtual Code       │                         │
│  │  -core (Plugin)     │    │  (.vue → .ts 转换)  │                         │
│  └─────────────────────┘    └──────────┬──────────┘                         │
│                                        │                                    │
│                                        ▼                                    │
│                             ┌─────────────────────┐                         │
│                             │  TypeScript         │                         │
│                             │  Language Service   │  类型检查、补全等       │
│                             └──────────┬──────────┘                         │
│                                        │                                    │
│                                        ▼                                    │
│                             ┌─────────────────────┐                         │
│                             │  Code Mappings      │  将结果映射回原位置     │
│                             └─────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 核心概念

### 虚拟代码 (Virtual Code)

Language Tools 的核心概念是**虚拟代码**．通过将 `.vue` 文件转换为 TypeScript，可以利用 TypeScript 语言服务的所有功能．

#### 转换示例

```vue
<!-- 原始 .vue 文件 -->
<template>
  <div>{{ message }}</div>
</template>

<script setup lang="ts">
import { ref } from 'chibivue'

const message = ref('Hello')
</script>
```

这会被转换为以下虚拟 TypeScript：

```ts
// 虚拟 TypeScript 代码
import { ref } from 'chibivue'

const message = ref('Hello')

// 用于类型检查模板表达式的代码
// 实际上不会执行，但允许 TypeScript 验证表达式类型
declare const __VLS_template: () => void;
(() => {
  // 对应模板中的 {{ message }}
  // TypeScript 验证 message 是否存在且类型正确
  const __VLS_expr0 = (message);
})();
```

通过这种转换：
- 可以验证 `message` 的类型是 `Ref<string>`
- 如果 `message` 未定义，会报告错误
- 悬停在 `message` 上时会显示类型信息

### 代码映射

**代码映射**将虚拟代码中的位置链接回原始 `.vue` 文件的位置．

```txt
原始 .vue 文件                        虚拟 TypeScript
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
                                映射将位置链接在一起
```

有了映射：
- 虚拟代码中的错误 → 在原始 `.vue` 文件的正确位置显示
- 执行"转到定义" → 将虚拟代码的位置转换为原始文件的位置

## 实现

### 类型定义

首先，定义表示 SFC 结构的类型．

```ts
// types.ts

/**
 * 表示 SFC 中的每个块（template、script、style）
 */
export interface SfcBlock {
  /** 块类型（"template"、"script"、"style" 等） */
  type: string;

  /** 块内容（不包括标签的内部内容） */
  content: string;

  /** 位置信息（用于错误显示和映射） */
  loc: {
    start: { line: number; column: number; offset: number };
    end: { line: number; column: number; offset: number };
  };

  /** 块属性（例如：lang="ts"、scoped） */
  attrs: Record<string, string | true>;

  /** 语言指定（attrs.lang 的快捷方式） */
  lang?: string;
}

/**
 * 表示解析后的整个 SFC
 */
export interface SfcDescriptor {
  /** <template> 块 */
  template: SfcBlock | null;

  /** <script>（不带 setup）块 */
  script: SfcBlock | null;

  /** <script setup> 块 */
  scriptSetup: SfcBlock | null;

  /** <style> 块（可以有多个） */
  styles: SfcBlock[];

  /** 自定义块（例如：<docs>） */
  customBlocks: SfcBlock[];
}
```

### SFC 解析器

解析 `.vue` 文件以生成 `SfcDescriptor`．

::: tip
在实际实现中，可以使用 chibivue 的 `@chibivue/compiler-sfc` 包中的 `parse` 函数．这里为了教育目的展示一个简化的解析器．
:::

```ts
// parseSfc.ts
import type { SfcBlock, SfcDescriptor } from './types';

/**
 * 解析 .vue 文件内容并返回 SfcDescriptor
 *
 * @param content - .vue 文件的内容
 * @param fileName - 文件名（用于错误消息）
 */
export function parseSfc(content: string, fileName: string): SfcDescriptor {
  const descriptor: SfcDescriptor = {
    template: null,
    script: null,
    scriptSetup: null,
    styles: [],
    customBlocks: [],
  };

  // 匹配顶级块的正则表达式
  // 检测 <tagName attrs>content</tagName> 格式
  const blockRegex = /<(\w+)([^>]*)>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(content)) !== null) {
    const [fullMatch, tagName, attrsString, blockContent] = match;

    // 计算块的起始位置
    const startOffset = match.index + `<${tagName}${attrsString}>`.length;
    const startPos = offsetToPosition(content, startOffset);

    // 计算块的结束位置
    const endOffset = startOffset + blockContent.length;
    const endPos = offsetToPosition(content, endOffset);

    // 解析属性（例如：'lang="ts" scoped' → { lang: "ts", scoped: true }）
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

    // 按块类型分类
    switch (tagName) {
      case 'template':
        descriptor.template = block;
        break;
      case 'script':
        // 根据是否有 setup 属性分类
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
 * 从偏移量（字符位置）计算行号和列号
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
 * 解析属性字符串为对象
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

### 虚拟代码生成

实现 Volar.js 的 `VirtualCode` 接口．这是 Language Tools 的核心．

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
 * 代码段：生成代码的一部分及其映射信息
 */
type CodeSegment = [
  code: string,                           // 要生成的代码
  sourceOffsetStart?: number,             // 源文件中的起始位置
  sourceOffsetEnd?: number,               // 源文件中的结束位置
  features?: { verification?: boolean },  // 映射功能设置
];

/**
 * 将 .vue 文件转换为虚拟 TypeScript 代码的类
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
   * 文件更新时调用
   */
  update(snapshot: ts.IScriptSnapshot): void {
    this.snapshot = snapshot;
    const content = snapshot.getText(0, snapshot.getLength());
    this.sfc = parseSfc(content, this.fileName);
    this.generateVirtualCode(content);
  }

  /**
   * 生成虚拟代码的主处理
   */
  private generateVirtualCode(sourceContent: string): void {
    const segments: CodeSegment[] = [];

    // 1. 从 script/scriptSetup 生成代码
    this.generateScriptCode(segments);

    // 2. 生成模板类型检查代码
    this.generateTemplateCode(segments);

    // 3. 从段构建最终代码和映射
    const { code, mappings } = this.buildCode(segments, sourceContent);

    // 4. 注册为嵌入代码（TypeScript）
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
   * 从 script/scriptSetup 块生成 TypeScript 代码
   */
  private generateScriptCode(segments: CodeSegment[]): void {
    const { script, scriptSetup } = this.sfc;

    if (scriptSetup) {
      // 原样输出 <script setup> 内容
      // 添加映射信息（链接到源文件位置）
      segments.push([
        scriptSetup.content,
        scriptSetup.loc.start.offset,
        scriptSetup.loc.end.offset,
        { verification: true },
      ]);
      segments.push(['\n']);
    } else if (script) {
      // 原样输出 <script> 内容
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
   * 生成用于类型检查模板表达式的代码
   */
  private generateTemplateCode(segments: CodeSegment[]): void {
    const { template } = this.sfc;
    if (!template) return;

    // 添加模板类型检查代码
    segments.push(['\n// Template type-checking\n']);
    segments.push(['declare const __VLS_template: () => void;\n']);

    // 检测 mustache 表达式 {{ expr }}
    const mustacheRegex = /\{\{\s*([\s\S]*?)\s*\}\}/g;
    let match: RegExpExecArray | null;
    let exprIndex = 0;

    while ((match = mustacheRegex.exec(template.content)) !== null) {
      const expr = match[1];
      // 计算表达式在源文件中的位置
      const exprStartInTemplate = match.index + match[0].indexOf(expr);
      const sourceStart = template.loc.start.offset + exprStartInTemplate;
      const sourceEnd = sourceStart + expr.length;

      // 生成验证表达式的代码
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
   * 从段构建最终代码和映射
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
        // 存在映射信息时记录
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
 * 创建 TypeScript 脚本快照
 */
function createScriptSnapshot(content: string): ts.IScriptSnapshot {
  return {
    getText: (start, end) => content.slice(start, end),
    getLength: () => content.length,
    getChangeRange: () => undefined,
  };
}
```

### 语言插件

实现告诉 Volar.js 如何处理 `.vue` 文件的插件．

```ts
// languagePlugin.ts
import type { LanguagePlugin } from '@volar/language-core';
import { ChibivueVirtualCode } from './virtualCode';

/**
 * 为 Volar.js 创建语言插件
 *
 * 此插件负责：
 * 1. 识别 .vue 文件
 * 2. 从 .vue 文件生成虚拟代码
 * 3. 向 TypeScript 语言服务提供虚拟代码
 */
export function createChibivueLanguagePlugin(): LanguagePlugin<
  string,
  ChibivueVirtualCode
> {
  return {
    /**
     * 从文件扩展名判断语言 ID
     * 对于 .vue 文件返回 "vue"
     */
    getLanguageId(scriptId: string): string | undefined {
      if (scriptId.endsWith('.vue')) {
        return 'vue';
      }
      return undefined;
    },

    /**
     * 创建新的虚拟代码
     * 首次打开文件时调用
     */
    createVirtualCode(scriptId, languageId, snapshot) {
      if (languageId === 'vue') {
        return new ChibivueVirtualCode(scriptId, snapshot);
      }
      return undefined;
    },

    /**
     * 更新现有的虚拟代码
     * 编辑文件时调用
     */
    updateVirtualCode(_scriptId, virtualCode, snapshot) {
      virtualCode.update(snapshot);
      return virtualCode;
    },

    /**
     * TypeScript 特定设置
     */
    typescript: {
      /**
       * 使 TypeScript 识别 .vue 文件的设置
       *
       * - extension: 目标文件扩展名
       * - isMixedContent: 表示包含多种语言
       * - scriptKind: TypeScript 的 ScriptKind
       *   - 7 = Deferred（延迟评估，使用虚拟代码）
       */
      extraFileExtensions: [
        { extension: 'vue', isMixedContent: true, scriptKind: 7 },
      ],

      /**
       * 从虚拟代码获取要传递给 TypeScript 的脚本
       *
       * @returns
       *   - code: 嵌入的 TypeScript 代码
       *   - extension: ".ts"（作为 TypeScript 处理）
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

### 语言服务器

LSP（语言服务器协议）服务器连接编辑器和语言功能．

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
 * 关于 LSP（语言服务器协议）
 *
 * LSP 是将编辑器与语言功能分离的协议．
 *
 * ┌──────────┐                        ┌──────────────────┐
 * │  VSCode  │ ◄───── LSP 通信 ─────► │  Language Server │
 * │  Neovim  │    (JSON-RPC over      │  （此文件）      │
 * │  Emacs   │     stdio/IPC)         │                  │
 * └──────────┘                        └──────────────────┘
 *
 * 主要 LSP 请求：
 * - textDocument/completion: 获取自动补全候选
 * - textDocument/hover: 获取悬停信息
 * - textDocument/definition: 转到定义
 * - textDocument/references: 查找引用
 * - textDocument/rename: 重命名符号
 * - textDocument/diagnostics: 错误诊断
 */

// 创建 LSP 连接（通过 stdin/stdout 或 IPC 通信）
const connection = createConnection();

// 创建 Volar 语言服务器
const server = createServer(connection);

// 开始监听连接
connection.listen();

/**
 * 初始化请求的处理程序
 * 客户端（编辑器）连接时调用
 */
connection.onInitialize((params) => {
  // 获取 TypeScript SDK 路径（从客户端传递）
  const tsdk = params.initializationOptions?.typescript?.tsdk;

  // 加载 TypeScript 模块
  const ts = tsdk
    ? loadTsdkByPath(tsdk, params.locale)
    : require('typescript');

  // 创建 chibivue 语言插件
  const chibivuePlugin = createChibivueLanguagePlugin();

  // 初始化服务器并注册功能
  return server.initialize(
    params,
    // 项目管理设置（tsconfig.json 检测等）
    createSimpleProjectProviderFactory(),
    {
      /**
       * 返回语言插件
       * 负责从 .vue 文件生成虚拟代码
       */
      getLanguagePlugins() {
        return [chibivuePlugin];
      },

      /**
       * 返回服务插件
       * 提供 TypeScript 语言功能（补全、诊断等）
       */
      getServicePlugins() {
        return [...createTypeScriptServices(ts)];
      },
    }
  );
});

/**
 * 初始化完成的处理程序
 */
connection.onInitialized(() => {
  // 根据需要进行额外设置
});
```

### VSCode 扩展

实现将 VSCode 连接到语言服务器的扩展．

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
 * 扩展激活
 * 打开 .vue 文件时自动调用
 */
export async function activate(context: vscode.ExtensionContext) {
  // 解析语言服务器路径
  const serverPath = context.asAbsolutePath(
    path.join('dist', 'server.js')
  );

  // 服务器启动选项
  const serverOptions: ServerOptions = {
    run: {
      module: serverPath,
      transport: TransportKind.ipc, // 通过 IPC 通信
    },
    debug: {
      module: serverPath,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6009'] },
    },
  };

  // 客户端选项
  const clientOptions: LanguageClientOptions = {
    // 处理哪些文件
    documentSelector: [{ scheme: 'file', language: 'vue' }],

    // 初始化时传递给服务器的选项
    initializationOptions: {
      typescript: {
        // 使用 VSCode 内置的 TypeScript SDK
        tsdk: path.join(
          vscode.env.appRoot,
          'extensions/node_modules/typescript/lib'
        ),
      },
    },
  };

  // 创建 Language Client
  client = new LanguageClient(
    'chibivue',                    // 客户端 ID
    'Chibivue Language Server',   // 显示名称
    serverOptions,
    clientOptions
  );

  // 启动语言服务器
  await client.start();

  // 扩展停用时清理
  context.subscriptions.push({
    dispose: () => client?.stop(),
  });
}

/**
 * 扩展停用
 */
export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
```

### 语法高亮（TextMate 语法）

语法高亮使用 TextMate 语法定义．这使用 VSCode 的内置功能，不涉及语言服务器．

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

## 支持的功能

| 功能       | 状态   | 描述                           |
| ---------- | ------ | ------------------------------ |
| 语法高亮   | 已支持 | 通过 TextMate 语法进行颜色编码 |
| 自动补全   | 已支持 | 变量，函数，属性补全           |
| 类型检查   | 已支持 | 通过 TypeScript 检测类型错误   |
| 转到定义   | 已支持 | 跳转到变量/函数定义            |
| 错误诊断   | 已支持 | 显示语法和类型错误             |
| 重命名符号 | 已支持 | 批量重命名变量等               |
| 悬停信息   | 已支持 | 显示光标位置的类型信息         |

## 总结

Language Tools 通过将 `.vue` 文件转换为虚拟 TypeScript 代码，使 SFC 中可以使用 TypeScript 的所有功能．

**主要组件：**

1. **SFC 解析器** - 将 `.vue` 文件分解为 template，script 和 style 块
2. **虚拟代码生成** - 将 SFC 转换为带有代码映射的 TypeScript
3. **语言插件** - 实现 Volar.js 接口以提供虚拟代码
4. **语言服务器** - 通过 LSP 与编辑器通信
5. **VSCode 扩展** - 将 VSCode 连接到语言服务器

此实现是用于教育目的的最小实现．生产环境使用的 [vuejs/language-tools](https://github.com/vuejs/language-tools) 添加了许多高级功能：

- 模板指令（`v-if`，`v-for` 等）的类型检查
- 组件 props 类型验证
- `<style scoped>` 选择器补全
- `<template>` 中的 HTML 补全
- 宏支持（`defineProps`，`defineEmits`）
