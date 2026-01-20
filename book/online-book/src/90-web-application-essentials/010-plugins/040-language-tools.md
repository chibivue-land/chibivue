# Language Tools

## What are Language Tools?

Language tools provide IDE support for `.vue` Single File Components (SFCs). They enable features like:

- Syntax highlighting
- Auto-completion
- Type checking
- Go to definition
- Error diagnostics

In the Vue.js ecosystem, [vuejs/language-tools](https://github.com/vuejs/language-tools) provides this functionality, built on [Volar.js](https://volarjs.dev/) as its foundation. In this chapter, we'll implement minimal language tools for chibivue using Volar.js.

## Why Do We Need Language Tools?

TypeScript's language service can only understand `.ts` and `.tsx` files. However, `.vue` files contain multiple languages mixed together:

```vue
<template>
  <div>{{ message }}</div>  <!-- HTML + expressions -->
</template>

<script setup lang="ts">
const message = ref('Hello')  // TypeScript
</script>

<style scoped>
div { color: red; }  /* CSS */
</style>
```

The role of Language Tools is to **transform** this composite file into a format that TypeScript's language service can understand. This transformation enables all TypeScript features (type checking, auto-completion, refactoring, etc.) to work within `.vue` files.

## Architecture Overview

Language tools consist of three main packages:

```txt
@extensions/
├── chibivue-language-core/     # Core language processing
│   ├── parseSfc.ts             # SFC parser
│   ├── virtualCode.ts          # Virtual code generation
│   ├── languagePlugin.ts       # Volar.js plugin
│   └── types.ts                # Type definitions
├── chibivue-language-server/   # LSP server
│   └── server.ts               # Language Server Protocol server
└── vscode-chibivue/            # VSCode extension
    ├── extension.ts            # Extension entry point
    ├── syntaxes/               # TextMate grammar
    └── language-configuration.json
```

### Data Flow

When you edit a `.vue` file in your editor, data flows through the following pipeline:

```txt
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VSCode                                         │
│  ┌─────────────┐                                                            │
│  │  App.vue    │  User edits .vue file                                      │
│  └──────┬──────┘                                                            │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────┐                                                    │
│  │  vscode-chibivue    │  VSCode extension detects file changes             │
│  │  (Language Client)  │                                                    │
│  └──────────┬──────────┘                                                    │
└─────────────┼───────────────────────────────────────────────────────────────┘
              │ LSP (Language Server Protocol)
              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  chibivue-language-server                                                   │
│  ┌─────────────────────┐                                                    │
│  │  Language Server    │  Receives LSP requests                             │
│  └──────────┬──────────┘                                                    │
│             │                                                               │
│             ▼                                                               │
│  ┌─────────────────────┐    ┌─────────────────────┐                         │
│  │  chibivue-language  │───▶│  Virtual Code       │                         │
│  │  -core (Plugin)     │    │  (.vue → .ts)       │                         │
│  └─────────────────────┘    └──────────┬──────────┘                         │
│                                        │                                    │
│                                        ▼                                    │
│                             ┌─────────────────────┐                         │
│                             │  TypeScript         │                         │
│                             │  Language Service   │  Type checking, etc.    │
│                             └──────────┬──────────┘                         │
│                                        │                                    │
│                                        ▼                                    │
│                             ┌─────────────────────┐                         │
│                             │  Code Mappings      │  Map results back       │
│                             └─────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Concepts

### Virtual Code

The core concept in Language Tools is **virtual code**. By transforming `.vue` files into TypeScript, we can leverage all features of the TypeScript language service.

#### Transformation Example

```vue
<!-- Original .vue file -->
<template>
  <div>{{ message }}</div>
</template>

<script setup lang="ts">
import { ref } from 'chibivue'

const message = ref('Hello')
</script>
```

This is transformed into virtual TypeScript:

```ts
// Virtual TypeScript code
import { ref } from 'chibivue'

const message = ref('Hello')

// Code for type-checking template expressions
// Not actually executed, but allows TypeScript to verify expression types
declare const __VLS_template: () => void;
(() => {
  // Corresponds to {{ message }} in template
  // TypeScript verifies that message exists and has correct type
  const __VLS_expr0 = (message);
})();
```

This transformation enables:
- Verification that `message` has type `Ref<string>`
- Error reporting if `message` is undefined
- Type information display when hovering over `message`

### Code Mappings

**Code mappings** link positions in virtual code back to positions in the original `.vue` file.

```txt
Original .vue file                    Virtual TypeScript
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
                                Mappings link positions together
```

With mappings:
- Errors in virtual code → Display at correct position in original `.vue` file
- "Go to Definition" → Transform virtual code position to original file position

## Implementation

### Type Definitions

First, we define types to represent the structure of an SFC.

```ts
// types.ts

/**
 * Represents each block (template, script, style) in an SFC
 */
export interface SfcBlock {
  /** Block type ("template", "script", "style", etc.) */
  type: string;

  /** Block content (inner content without tags) */
  content: string;

  /** Position information (used for error display and mappings) */
  loc: {
    start: { line: number; column: number; offset: number };
    end: { line: number; column: number; offset: number };
  };

  /** Block attributes (e.g., lang="ts", scoped) */
  attrs: Record<string, string | true>;

  /** Language specification (shortcut for attrs.lang) */
  lang?: string;
}

/**
 * Represents the entire parsed SFC
 */
export interface SfcDescriptor {
  /** <template> block */
  template: SfcBlock | null;

  /** <script> (without setup) block */
  script: SfcBlock | null;

  /** <script setup> block */
  scriptSetup: SfcBlock | null;

  /** <style> blocks (can have multiple) */
  styles: SfcBlock[];

  /** Custom blocks (e.g., <docs>) */
  customBlocks: SfcBlock[];
}
```

### SFC Parser

Parse `.vue` files to generate `SfcDescriptor`.

::: tip
In actual implementation, you can use the `parse` function from chibivue's `@chibivue/compiler-sfc` package. Here we show a simplified parser for educational purposes.
:::

```ts
// parseSfc.ts
import type { SfcBlock, SfcDescriptor } from './types';

/**
 * Parse .vue file content and return SfcDescriptor
 *
 * @param content - Content of .vue file
 * @param fileName - File name (for error messages)
 */
export function parseSfc(content: string, fileName: string): SfcDescriptor {
  const descriptor: SfcDescriptor = {
    template: null,
    script: null,
    scriptSetup: null,
    styles: [],
    customBlocks: [],
  };

  // Regex to match top-level blocks
  // Detects <tagName attrs>content</tagName> format
  const blockRegex = /<(\w+)([^>]*)>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(content)) !== null) {
    const [fullMatch, tagName, attrsString, blockContent] = match;

    // Calculate block start position
    const startOffset = match.index + `<${tagName}${attrsString}>`.length;
    const startPos = offsetToPosition(content, startOffset);

    // Calculate block end position
    const endOffset = startOffset + blockContent.length;
    const endPos = offsetToPosition(content, endOffset);

    // Parse attributes (e.g., 'lang="ts" scoped' → { lang: "ts", scoped: true })
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

    // Categorize by block type
    switch (tagName) {
      case 'template':
        descriptor.template = block;
        break;
      case 'script':
        // Categorize by presence of setup attribute
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
 * Calculate line/column numbers from offset (character position)
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
 * Parse attribute string to object
 * Example: ' lang="ts" scoped' → { lang: "ts", scoped: true }
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

### Virtual Code Generation

Implement the Volar.js `VirtualCode` interface. This is the heart of Language Tools.

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
 * Code segment: A piece of generated code with its mapping info
 */
type CodeSegment = [
  code: string,                           // Code to generate
  sourceOffsetStart?: number,             // Start position in source file
  sourceOffsetEnd?: number,               // End position in source file
  features?: { verification?: boolean },  // Mapping feature settings
];

/**
 * Class that transforms .vue files into virtual TypeScript code
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
   * Called when file is updated
   */
  update(snapshot: ts.IScriptSnapshot): void {
    this.snapshot = snapshot;
    const content = snapshot.getText(0, snapshot.getLength());
    this.sfc = parseSfc(content, this.fileName);
    this.generateVirtualCode(content);
  }

  /**
   * Main process to generate virtual code
   */
  private generateVirtualCode(sourceContent: string): void {
    const segments: CodeSegment[] = [];

    // 1. Generate code from script/scriptSetup
    this.generateScriptCode(segments);

    // 2. Generate template type-checking code
    this.generateTemplateCode(segments);

    // 3. Build final code and mappings from segments
    const { code, mappings } = this.buildCode(segments, sourceContent);

    // 4. Register as embedded code (TypeScript)
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
   * Generate TypeScript code from script/scriptSetup blocks
   */
  private generateScriptCode(segments: CodeSegment[]): void {
    const { script, scriptSetup } = this.sfc;

    if (scriptSetup) {
      // Output <script setup> content as-is
      // Add mapping info (link to source file position)
      segments.push([
        scriptSetup.content,
        scriptSetup.loc.start.offset,
        scriptSetup.loc.end.offset,
        { verification: true },
      ]);
      segments.push(['\n']);
    } else if (script) {
      // Output <script> content as-is
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
   * Generate code for type-checking template expressions
   */
  private generateTemplateCode(segments: CodeSegment[]): void {
    const { template } = this.sfc;
    if (!template) return;

    // Add template type-checking code
    segments.push(['\n// Template type-checking\n']);
    segments.push(['declare const __VLS_template: () => void;\n']);

    // Detect mustache expressions {{ expr }}
    const mustacheRegex = /\{\{\s*([\s\S]*?)\s*\}\}/g;
    let match: RegExpExecArray | null;
    let exprIndex = 0;

    while ((match = mustacheRegex.exec(template.content)) !== null) {
      const expr = match[1];
      // Calculate expression position in source file
      const exprStartInTemplate = match.index + match[0].indexOf(expr);
      const sourceStart = template.loc.start.offset + exprStartInTemplate;
      const sourceEnd = sourceStart + expr.length;

      // Generate code to verify expression
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
   * Build final code and mappings from segments
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
        // Record mapping info when present
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
 * Create TypeScript script snapshot
 */
function createScriptSnapshot(content: string): ts.IScriptSnapshot {
  return {
    getText: (start, end) => content.slice(start, end),
    getLength: () => content.length,
    getChangeRange: () => undefined,
  };
}
```

### Language Plugin

Implement a plugin that tells Volar.js how to handle `.vue` files.

```ts
// languagePlugin.ts
import type { LanguagePlugin } from '@volar/language-core';
import { ChibivueVirtualCode } from './virtualCode';

/**
 * Create language plugin for Volar.js
 *
 * This plugin is responsible for:
 * 1. Identifying .vue files
 * 2. Generating virtual code from .vue files
 * 3. Providing virtual code to TypeScript language service
 */
export function createChibivueLanguagePlugin(): LanguagePlugin<
  string,
  ChibivueVirtualCode
> {
  return {
    /**
     * Determine language ID from file extension
     * Returns "vue" for .vue files
     */
    getLanguageId(scriptId: string): string | undefined {
      if (scriptId.endsWith('.vue')) {
        return 'vue';
      }
      return undefined;
    },

    /**
     * Create new virtual code
     * Called when file is first opened
     */
    createVirtualCode(scriptId, languageId, snapshot) {
      if (languageId === 'vue') {
        return new ChibivueVirtualCode(scriptId, snapshot);
      }
      return undefined;
    },

    /**
     * Update existing virtual code
     * Called when file is edited
     */
    updateVirtualCode(_scriptId, virtualCode, snapshot) {
      virtualCode.update(snapshot);
      return virtualCode;
    },

    /**
     * TypeScript-specific settings
     */
    typescript: {
      /**
       * Settings to make TypeScript recognize .vue files
       *
       * - extension: Target file extension
       * - isMixedContent: Indicates multiple languages are contained
       * - scriptKind: TypeScript's ScriptKind
       *   - 7 = Deferred (lazy evaluation, uses virtual code)
       */
      extraFileExtensions: [
        { extension: 'vue', isMixedContent: true, scriptKind: 7 },
      ],

      /**
       * Get script to pass to TypeScript from virtual code
       *
       * @returns
       *   - code: Embedded TypeScript code
       *   - extension: ".ts" (treat as TypeScript)
       *   - scriptKind: 3 = TS (regular TypeScript)
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

### Language Server

The LSP (Language Server Protocol) server bridges the editor and language features.

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
 * About LSP (Language Server Protocol)
 *
 * LSP is a protocol for separating editors from language features.
 *
 * ┌──────────┐                        ┌──────────────────┐
 * │  VSCode  │ ◄───── LSP comm ─────► │  Language Server │
 * │  Neovim  │    (JSON-RPC over      │  (this file)     │
 * │  Emacs   │     stdio/IPC)         │                  │
 * └──────────┘                        └──────────────────┘
 *
 * Main LSP requests:
 * - textDocument/completion: Get auto-completion candidates
 * - textDocument/hover: Get hover information
 * - textDocument/definition: Go to definition
 * - textDocument/references: Find references
 * - textDocument/rename: Rename symbol
 * - textDocument/diagnostics: Error diagnostics
 */

// Create LSP connection (communicate via stdin/stdout or IPC)
const connection = createConnection();

// Create Volar language server
const server = createServer(connection);

// Start listening on connection
connection.listen();

/**
 * Handler for initialization request
 * Called when client (editor) connects
 */
connection.onInitialize((params) => {
  // Get TypeScript SDK path (passed from client)
  const tsdk = params.initializationOptions?.typescript?.tsdk;

  // Load TypeScript module
  const ts = tsdk
    ? loadTsdkByPath(tsdk, params.locale)
    : require('typescript');

  // Create chibivue language plugin
  const chibivuePlugin = createChibivueLanguagePlugin();

  // Initialize server and register capabilities
  return server.initialize(
    params,
    // Project management settings (tsconfig.json detection, etc.)
    createSimpleProjectProviderFactory(),
    {
      /**
       * Return language plugins
       * Responsible for virtual code generation from .vue files
       */
      getLanguagePlugins() {
        return [chibivuePlugin];
      },

      /**
       * Return service plugins
       * Provide TypeScript language features (completion, diagnostics, etc.)
       */
      getServicePlugins() {
        return [...createTypeScriptServices(ts)];
      },
    }
  );
});

/**
 * Handler for initialization complete
 */
connection.onInitialized(() => {
  // Additional setup as needed
});
```

### VSCode Extension

Implement the extension that connects VSCode to the language server.

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
 * Extension activation
 * Called automatically when .vue file is opened
 */
export async function activate(context: vscode.ExtensionContext) {
  // Resolve language server path
  const serverPath = context.asAbsolutePath(
    path.join('dist', 'server.js')
  );

  // Server launch options
  const serverOptions: ServerOptions = {
    run: {
      module: serverPath,
      transport: TransportKind.ipc, // Communicate via IPC
    },
    debug: {
      module: serverPath,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6009'] },
    },
  };

  // Client options
  const clientOptions: LanguageClientOptions = {
    // Which files to process
    documentSelector: [{ scheme: 'file', language: 'vue' }],

    // Options to pass to server on initialization
    initializationOptions: {
      typescript: {
        // Use VSCode's built-in TypeScript SDK
        tsdk: path.join(
          vscode.env.appRoot,
          'extensions/node_modules/typescript/lib'
        ),
      },
    },
  };

  // Create Language Client
  client = new LanguageClient(
    'chibivue',                    // Client ID
    'Chibivue Language Server',   // Display name
    serverOptions,
    clientOptions
  );

  // Start language server
  await client.start();

  // Cleanup on extension deactivation
  context.subscriptions.push({
    dispose: () => client?.stop(),
  });
}

/**
 * Extension deactivation
 */
export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
```

### Syntax Highlighting (TextMate Grammar)

Syntax highlighting is defined using TextMate grammar. This uses VSCode's built-in functionality and doesn't involve the language server.

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

## Supported Features

| Feature             | Status    | Description                              |
| ------------------- | --------- | ---------------------------------------- |
| Syntax Highlighting | Supported | Color coding via TextMate grammar        |
| Auto-completion     | Supported | Variable, function, property completion  |
| Type Checking       | Supported | Type error detection via TypeScript      |
| Go to Definition    | Supported | Jump to variable/function definitions    |
| Error Diagnostics   | Supported | Display syntax and type errors           |
| Rename Symbol       | Supported | Bulk rename variables, etc.              |
| Hover Information   | Supported | Display type info at cursor position     |

## Summary

Language Tools enable all TypeScript features in SFCs by transforming `.vue` files into virtual TypeScript code.

**Key Components:**

1. **SFC Parser** - Decompose `.vue` files into template, script, and style blocks
2. **Virtual Code Generation** - Transform SFC to TypeScript with code mappings
3. **Language Plugin** - Implement Volar.js interface to provide virtual code
4. **Language Server** - Communicate with editors via LSP
5. **VSCode Extension** - Connect VSCode to the language server

This implementation is minimal for educational purposes. Production implementations like [vuejs/language-tools](https://github.com/vuejs/language-tools) add many advanced features:

- Type checking for template directives (`v-if`, `v-for`, etc.)
- Component props type validation
- `<style scoped>` selector completion
- HTML completion in `<template>`
- Macro support (`defineProps`, `defineEmits`)
