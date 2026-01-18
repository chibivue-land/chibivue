# CSS プリプロセッサ

## プリプロセッサとは

CSS プリプロセッサは，CSS を拡張した言語（SCSS，Less，Stylus など）を標準の CSS に変換するツールです．これらの言語は変数，ネスト，ミックスイン，関数などの機能を提供し，CSS の記述をより効率的にします．

<KawaikoNote variant="question" title="なぜプリプロセッサを使うの？">

プレーンな CSS にはいくつかの制限があります：
- 変数がない（CSS カスタムプロパティは後から追加されましたが）
- ネストができない
- コードの再利用が難しい

プリプロセッサはこれらの問題を解決し，保守性の高いスタイルシートを書けるようにします．

</KawaikoNote>

Vue SFC では，`<style>` ブロックに `lang` 属性を指定することでプリプロセッサを使用できます．

```vue
<style lang="scss">
$primary-color: #42b883;

.container {
  .title {
    color: $primary-color;
  }
}
</style>
```

## サポートされているプリプロセッサ

Vue/chibivue では以下のプリプロセッサをサポートしています：

| プリプロセッサ | lang 属性 | 特徴 |
|--------------|----------|------|
| **SCSS** | `scss` | CSS に近い構文，変数，ネスト，ミックスイン |
| **Sass** | `sass` | インデントベースの構文（波括弧なし） |
| **Less** | `less` | 変数（`@`），ミックスイン，関数 |
| **Stylus** | `styl`, `stylus` | 柔軟な構文，オプションの区切り文字 |

## 型定義

### StylePreprocessor

プリプロセッサの共通インターフェースです．

```ts
// style/preprocessors.ts
export type StylePreprocessor = (
  source: string,
  map: RawSourceMap | undefined,
  options: {
    [key: string]: any;
    additionalData?: string | ((source: string, filename: string) => string);
    filename: string;
  },
  customRequire: (id: string) => any,
) => StylePreprocessorResults;
```

### StylePreprocessorResults

プリプロセッサの処理結果を表す型です．

```ts
export interface StylePreprocessorResults {
  code: string;           // 変換後の CSS
  map?: object;          // ソースマップ
  errors: Error[];       // エラー一覧
  dependencies: string[]; // 依存ファイル（@import など）
}
```

`dependencies` は重要です．プリプロセッサで `@import` したファイルが変更された際に，Vite などのツールが再ビルドをトリガーできるようになります．

## 処理フロー

```
SFC ファイル (.vue)
    ↓
[SFC Parser] - <style lang="scss"> を検出
    ↓
[compileStyle]
    ↓
1. プリプロセッサの選択
   processors[preprocessLang] → scss プリプロセッサ
    ↓
2. プリプロセッサで変換
   SCSS/Sass/Less/Stylus → CSS
    ↓
3. PostCSS パイプライン
   ├── cssVarsPlugin (v-bind 処理)
   ├── trimPlugin (空白削除)
   └── scopedPlugin (scoped CSS)
    ↓
4. 結果を返す
   { code, map, errors, dependencies }
```

## プリプロセッサの実装

### SCSS プリプロセッサ

```ts
// style/preprocessors.ts
const scss: StylePreprocessor = (source, map, options, load = require) => {
  // Dart Sass ライブラリを動的にロード
  const nodeSass: typeof import("sass") = load("sass");
  const { compileString, renderSync } = nodeSass;

  // additionalData の適用（共通変数の注入など）
  const data = getSource(source, options.filename, options.additionalData);

  let css: string;
  let dependencies: string[];
  let sourceMap: any;

  try {
    if (compileString) {
      // 新しい API（Sass 1.55.0 以降）
      const result = compileString(data, {
        ...options,
        url: pathToFileURL(options.filename),
        sourceMap: !!map,
      });
      css = result.css;
      dependencies = result.loadedUrls.map((url) => fileURLToPath(url));
      sourceMap = map ? result.sourceMap! : undefined;
    } else {
      // 旧 API（後方互換性）
      const result = renderSync({
        ...options,
        data,
        file: options.filename,
        outFile: options.filename,
        sourceMap: !!map,
      });
      css = result.css.toString();
      dependencies = result.stats.includedFiles;
      sourceMap = map ? JSON.parse(result.map!.toString()) : undefined;
    }

    // ソースマップのマージ
    if (map) {
      return {
        code: css,
        errors: [],
        dependencies,
        map: merge(map, sourceMap!),
      };
    }
    return { code: css, errors: [], dependencies };
  } catch (e: any) {
    return { code: "", errors: [e], dependencies: [] };
  }
};
```

<KawaikoNote variant="warning" title="API の互換性">

Sass には新旧 2 つの API があります．
`compileString` は新しい API で，`renderSync` は旧 API です．
両方に対応することで，どのバージョンの Sass でも動作します．

</KawaikoNote>

### Sass プリプロセッサ

Sass は SCSS と同じエンジンを使用しますが，インデントベースの構文を使用します．

```ts
const sass: StylePreprocessor = (source, map, options, load) =>
  scss(
    source,
    map,
    {
      ...options,
      indentedSyntax: true,  // インデント構文を有効化
    },
    load,
  );
```

### Less プリプロセッサ

```ts
const less: StylePreprocessor = (source, map, options, load = require) => {
  const nodeLess = load("less");

  let result: any;
  let error: Error | null = null;

  // Less の render は非同期だが，syncImport: true で同期的に実行
  nodeLess.render(
    getSource(source, options.filename, options.additionalData),
    { ...options, syncImport: true },
    (err: Error | null, output: any) => {
      error = err;
      result = output;
    },
  );

  if (error) return { code: "", errors: [error], dependencies: [] };

  // Less は imports プロパティで依存ファイルを返す
  const dependencies = result.imports;

  if (map) {
    return {
      code: result.css.toString(),
      map: merge(map, result.map),
      errors: [],
      dependencies,
    };
  }

  return {
    code: result.css.toString(),
    errors: [],
    dependencies,
  };
};
```

### Stylus プリプロセッサ

```ts
const styl: StylePreprocessor = (source, map, options, load = require) => {
  const nodeStylus = load("stylus");

  try {
    const ref = nodeStylus(source, options);

    // ソースマップの設定
    if (map) ref.set("sourcemap", { inline: false, comment: false });

    const result = ref.render();
    const dependencies = ref.deps();  // 依存ファイルを取得

    if (map) {
      return {
        code: result,
        map: merge(map, ref.sourcemap),
        errors: [],
        dependencies,
      };
    }

    return { code: result, errors: [], dependencies };
  } catch (e: any) {
    return { code: "", errors: [e], dependencies: [] };
  }
};
```

## additionalData による共通スタイルの注入

`additionalData` オプションを使用すると，すべてのスタイルファイルに共通のコードを注入できます．

```ts
function getSource(
  source: string,
  filename: string,
  additionalData?: string | ((source: string, filename: string) => string),
) {
  if (!additionalData) return source;

  // 関数の場合は動的に生成
  if (isFunction(additionalData)) {
    return additionalData(source, filename);
  }

  // 文字列の場合はソースの先頭に追加
  return additionalData + source;
}
```

使用例（Vite 設定）：

```ts
// vite.config.ts
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        // 全ての SCSS ファイルに変数を注入
        additionalData: `@import "@/styles/variables.scss";`,
      },
    },
  },
});
```

<KawaikoNote variant="funny" title="グローバル変数の注入">

`additionalData` は「すべてのスタイルファイルの先頭に自動でコピペする」機能です．
変数やミックスインを毎回 import する手間が省けます．

</KawaikoNote>

## プリプロセッサの登録

```ts
export type PreprocessLang = "less" | "sass" | "scss" | "styl" | "stylus";

export const processors: Record<PreprocessLang, StylePreprocessor> = {
  less,
  sass,
  scss,
  styl,
  stylus: styl,  // エイリアス
};
```

## compileStyle での統合

プリプロセッサは `compileStyle` 関数の中で呼び出されます．

```ts
// compileStyle.ts
export function doCompileStyle(options: SFCAsyncStyleCompileOptions) {
  const {
    filename,
    id,
    scoped = false,
    trim = true,
    preprocessLang,
    // ...
  } = options;

  // プリプロセッサの選択
  const preprocessor = preprocessLang && processors[preprocessLang];

  // プリプロセッサがあれば実行
  const preProcessedSource = preprocessor && preprocess(options, preprocessor);

  // ソースマップの取得（プリプロセッサからまたは入力から）
  const map = preProcessedSource ? preProcessedSource.map : options.inMap;

  // CSS ソース（変換後または元のまま）
  const source = preProcessedSource ? preProcessedSource.code : options.source;

  // PostCSS パイプラインを構築
  const plugins = (postcssPlugins || []).slice();
  plugins.unshift(cssVarsPlugin({ id: shortId, isProd }));
  if (trim) plugins.push(trimPlugin());
  if (scoped) plugins.push(scopedPlugin(longId));

  // 依存ファイルの収集
  const dependencies = new Set(
    preProcessedSource ? preProcessedSource.dependencies : []
  );

  // PostCSS で処理
  const result = postcss(plugins).process(source, postCSSOptions);

  return {
    code: result.css,
    map: result.map?.toJSON(),
    errors: [...errors],
    dependencies,
  };
}
```

## 使用例

### SCSS

```vue
<style lang="scss">
$primary: #42b883;
$secondary: #35495e;

.card {
  background: $secondary;

  .title {
    color: $primary;
    font-size: 1.5rem;
  }

  &:hover {
    box-shadow: 0 4px 8px rgba($secondary, 0.3);
  }
}
</style>
```

### Less

```vue
<style lang="less">
@primary: #42b883;
@secondary: #35495e;

.card {
  background: @secondary;

  .title {
    color: @primary;
    font-size: 1.5rem;
  }

  &:hover {
    box-shadow: 0 4px 8px fade(@secondary, 30%);
  }
}
</style>
```

### Stylus

```vue
<style lang="stylus">
primary = #42b883
secondary = #35495e

.card
  background secondary

  .title
    color primary
    font-size 1.5rem

  &:hover
    box-shadow 0 4px 8px rgba(secondary, 0.3)
</style>
```

## ソースマップの連鎖

プリプロセッサと PostCSS の両方がソースマップを生成します．これらを正しく連結するために `merge-source-map` ライブラリを使用しています．

```
SCSS ソース
    ↓ [SCSS → CSS]
    ↓ ソースマップ A
CSS
    ↓ [PostCSS]
    ↓ ソースマップ B
最終 CSS
    ↓
merge(A, B) → 最終ソースマップ
```

これにより，ブラウザの DevTools でデバッグする際に，元の SCSS/Less/Stylus ファイルの行番号が表示されます．

<KawaikoNote variant="surprise" title="デバッグが楽になる！">

ソースマップがあれば，ブラウザで「この CSS どこから来たの？」と思ったときに，
変換前の SCSS ファイルの正確な位置がわかります．

</KawaikoNote>

## まとめ

CSS プリプロセッサの実装は以下の要素で構成されています：

1. **共通インターフェース**: `StylePreprocessor` 型で各プリプロセッサを抽象化
2. **動的ロード**: `require()` または `customRequire` でプリプロセッサをロード
3. **additionalData**: 共通スタイル（変数，ミックスインなど）の注入
4. **依存ファイル追跡**: `@import` したファイルを収集してホットリロードに対応
5. **ソースマップの連鎖**: プリプロセッサと PostCSS のソースマップをマージ
6. **PostCSS との統合**: プリプロセッサの出力を PostCSS パイプラインに渡す

Vue/chibivue の SFC コンパイラは，プリプロセッサを抽象化することで，ユーザーが好みの CSS 言語を使えるようにしています．
