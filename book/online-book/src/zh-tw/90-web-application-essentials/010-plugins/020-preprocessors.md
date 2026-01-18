# CSS 預處理器

## 什麼是預處理器？

CSS 預處理器是將擴展的 CSS 語言（SCSS，Less，Stylus 等）轉換為標準 CSS 的工具．這些語言提供了變數，巢狀，混入和函數等功能，使 CSS 編寫更加高效．

<KawaikoNote variant="question" title="為什麼使用預處理器？">

純 CSS 有一些限制：
- 沒有變數（CSS 自訂屬性是後來添加的）
- 沒有巢狀
- 程式碼複用困難

預處理器解決了這些問題，使編寫可維護的樣式表成為可能．

</KawaikoNote>

在 Vue SFC 中，你可以通過在 `<style>` 區塊上指定 `lang` 屬性來使用預處理器．

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

## 支援的預處理器

Vue/chibivue 支援以下預處理器：

| 預處理器 | lang 屬性 | 特點 |
|---------|----------|------|
| **SCSS** | `scss` | 類 CSS 語法，變數，巢狀，混入 |
| **Sass** | `sass` | 基於縮排的語法（無花括號）|
| **Less** | `less` | 變數（`@`），混入，函數 |
| **Stylus** | `styl`, `stylus` | 靈活語法，可選分隔符 |

## 類型定義

### StylePreprocessor

預處理器的通用介面．

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

表示預處理器結果的類型．

```ts
export interface StylePreprocessorResults {
  code: string;           // 轉換後的 CSS
  map?: object;          // Source map
  errors: Error[];       // 錯誤列表
  dependencies: string[]; // 依賴檔案（@import 等）
}
```

`dependencies` 很重要．它使 Vite 等工具能夠在預處理器中通過 `@import` 匯入的檔案發生變化時觸發重新建置．

## 處理流程

```
SFC 檔案 (.vue)
    ↓
[SFC 解析器] - 偵測 <style lang="scss">
    ↓
[compileStyle]
    ↓
1. 選擇預處理器
   processors[preprocessLang] → scss 預處理器
    ↓
2. 使用預處理器轉換
   SCSS/Sass/Less/Stylus → CSS
    ↓
3. PostCSS 管道
   ├── cssVarsPlugin (v-bind 處理)
   ├── trimPlugin (空白刪除)
   └── scopedPlugin (scoped CSS)
    ↓
4. 返回結果
   { code, map, errors, dependencies }
```

## 預處理器實現

### SCSS 預處理器

```ts
// style/preprocessors.ts
const scss: StylePreprocessor = (source, map, options, load = require) => {
  // 動態載入 Dart Sass 函式庫
  const nodeSass: typeof import("sass") = load("sass");
  const { compileString, renderSync } = nodeSass;

  // 套用 additionalData（注入公共變數等）
  const data = getSource(source, options.filename, options.additionalData);

  let css: string;
  let dependencies: string[];
  let sourceMap: any;

  try {
    if (compileString) {
      // 新 API（Sass 1.55.0+）
      const result = compileString(data, {
        ...options,
        url: pathToFileURL(options.filename),
        sourceMap: !!map,
      });
      css = result.css;
      dependencies = result.loadedUrls.map((url) => fileURLToPath(url));
      sourceMap = map ? result.sourceMap! : undefined;
    } else {
      // 舊 API（向後相容）
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

    // 合併 source map
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

<KawaikoNote variant="warning" title="API 相容性">

Sass 有兩套 API：舊版和新版．
`compileString` 是新 API，`renderSync` 是舊 API．
同時支援兩者確保與任何 Sass 版本相容．

</KawaikoNote>

### Sass 預處理器

Sass 使用與 SCSS 相同的引擎，但使用基於縮排的語法．

```ts
const sass: StylePreprocessor = (source, map, options, load) =>
  scss(
    source,
    map,
    {
      ...options,
      indentedSyntax: true,  // 啟用縮排語法
    },
    load,
  );
```

### Less 預處理器

```ts
const less: StylePreprocessor = (source, map, options, load = require) => {
  const nodeLess = load("less");

  let result: any;
  let error: Error | null = null;

  // Less 的 render 是非同步的，但 syncImport: true 使其同步
  nodeLess.render(
    getSource(source, options.filename, options.additionalData),
    { ...options, syncImport: true },
    (err: Error | null, output: any) => {
      error = err;
      result = output;
    },
  );

  if (error) return { code: "", errors: [error], dependencies: [] };

  // Less 通過 imports 屬性返回依賴
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

### Stylus 預處理器

```ts
const styl: StylePreprocessor = (source, map, options, load = require) => {
  const nodeStylus = load("stylus");

  try {
    const ref = nodeStylus(source, options);

    // 設定 source map
    if (map) ref.set("sourcemap", { inline: false, comment: false });

    const result = ref.render();
    const dependencies = ref.deps();  // 獲取依賴

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

## 使用 additionalData 注入公共樣式

`additionalData` 選項允許你向所有樣式檔案注入公共程式碼．

```ts
function getSource(
  source: string,
  filename: string,
  additionalData?: string | ((source: string, filename: string) => string),
) {
  if (!additionalData) return source;

  // 如果是函數，動態生成
  if (isFunction(additionalData)) {
    return additionalData(source, filename);
  }

  // 如果是字串，添加到原始碼前面
  return additionalData + source;
}
```

使用範例（Vite 設定）：

```ts
// vite.config.ts
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        // 向所有 SCSS 檔案注入變數
        additionalData: `@import "@/styles/variables.scss";`,
      },
    },
  },
});
```

<KawaikoNote variant="funny" title="注入全域變數">

`additionalData` 就像「自動複製貼上到每個樣式檔案的開頭」．
它省去了每次都要匯入變數和混入的麻煩．

</KawaikoNote>

## 預處理器註冊

```ts
export type PreprocessLang = "less" | "sass" | "scss" | "styl" | "stylus";

export const processors: Record<PreprocessLang, StylePreprocessor> = {
  less,
  sass,
  scss,
  styl,
  stylus: styl,  // 別名
};
```

## 在 compileStyle 中的整合

預處理器在 `compileStyle` 函數中被呼叫．

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

  // 選擇預處理器
  const preprocessor = preprocessLang && processors[preprocessLang];

  // 如果存在則執行預處理器
  const preProcessedSource = preprocessor && preprocess(options, preprocessor);

  // 獲取 source map（來自預處理器或輸入）
  const map = preProcessedSource ? preProcessedSource.map : options.inMap;

  // CSS 原始碼（轉換後的或原始的）
  const source = preProcessedSource ? preProcessedSource.code : options.source;

  // 建置 PostCSS 管道
  const plugins = (postcssPlugins || []).slice();
  plugins.unshift(cssVarsPlugin({ id: shortId, isProd }));
  if (trim) plugins.push(trimPlugin());
  if (scoped) plugins.push(scopedPlugin(longId));

  // 收集依賴
  const dependencies = new Set(
    preProcessedSource ? preProcessedSource.dependencies : []
  );

  // 使用 PostCSS 處理
  const result = postcss(plugins).process(source, postCSSOptions);

  return {
    code: result.css,
    map: result.map?.toJSON(),
    errors: [...errors],
    dependencies,
  };
}
```

## 使用範例

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

## Source Map 鏈結

預處理器和 PostCSS 都會生成 source map．我們使用 `merge-source-map` 函式庫來正確地鏈結它們．

```
SCSS 原始碼
    ↓ [SCSS → CSS]
    ↓ Source map A
CSS
    ↓ [PostCSS]
    ↓ Source map B
最終 CSS
    ↓
merge(A, B) → 最終 source map
```

這使得瀏覽器開發工具在除錯時可以顯示原始 SCSS/Less/Stylus 檔案的行號．

<KawaikoNote variant="surprise" title="除錯更輕鬆！">

有了 source map，當你在瀏覽器中想知道「這個 CSS 是從哪裡來的？」時，
你可以看到轉換前原始 SCSS 檔案中的確切位置．

</KawaikoNote>

## 總結

CSS 預處理器實現由以下部分組成：

1. **通用介面**：用 `StylePreprocessor` 類型抽象每個預處理器
2. **動態載入**：用 `require()` 或 `customRequire` 載入預處理器
3. **additionalData**：注入公共樣式（變數，混入等）
4. **依賴追蹤**：收集 `@import` 的檔案以支援熱重載
5. **Source map 鏈結**：合併預處理器和 PostCSS 的 source map
6. **PostCSS 整合**：將預處理器輸出傳遞給 PostCSS 管道

Vue/chibivue SFC 編譯器抽象了預處理器，允許使用者使用他們喜歡的 CSS 語言．
