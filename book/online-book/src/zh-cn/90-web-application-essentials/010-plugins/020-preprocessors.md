# CSS 预处理器

## 什么是预处理器？

CSS 预处理器是将扩展的 CSS 语言（SCSS，Less，Stylus 等）转换为标准 CSS 的工具．这些语言提供了变量，嵌套，混入和函数等功能，使 CSS 编写更加高效．

<KawaikoNote variant="question" title="为什么使用预处理器？">

纯 CSS 有一些限制：
- 没有变量（CSS 自定义属性是后来添加的）
- 没有嵌套
- 代码复用困难

预处理器解决了这些问题，使编写可维护的样式表成为可能．

</KawaikoNote>

在 Vue SFC 中，你可以通过在 `<style>` 块上指定 `lang` 属性来使用预处理器．

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

## 支持的预处理器

Vue/chibivue 支持以下预处理器：

| 预处理器 | lang 属性 | 特点 |
|---------|----------|------|
| **SCSS** | `scss` | 类 CSS 语法，变量，嵌套，混入 |
| **Sass** | `sass` | 基于缩进的语法（无花括号）|
| **Less** | `less` | 变量（`@`），混入，函数 |
| **Stylus** | `styl`, `stylus` | 灵活语法，可选分隔符 |

## 类型定义

### StylePreprocessor

预处理器的通用接口．

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

表示预处理器结果的类型．

```ts
export interface StylePreprocessorResults {
  code: string;           // 转换后的 CSS
  map?: object;          // Source map
  errors: Error[];       // 错误列表
  dependencies: string[]; // 依赖文件（@import 等）
}
```

`dependencies` 很重要．它使 Vite 等工具能够在预处理器中通过 `@import` 导入的文件发生变化时触发重新构建．

## 处理流程

```
SFC 文件 (.vue)
    ↓
[SFC 解析器] - 检测 <style lang="scss">
    ↓
[compileStyle]
    ↓
1. 选择预处理器
   processors[preprocessLang] → scss 预处理器
    ↓
2. 使用预处理器转换
   SCSS/Sass/Less/Stylus → CSS
    ↓
3. PostCSS 管道
   ├── cssVarsPlugin (v-bind 处理)
   ├── trimPlugin (空白删除)
   └── scopedPlugin (scoped CSS)
    ↓
4. 返回结果
   { code, map, errors, dependencies }
```

## 预处理器实现

### SCSS 预处理器

```ts
// style/preprocessors.ts
const scss: StylePreprocessor = (source, map, options, load = require) => {
  // 动态加载 Dart Sass 库
  const nodeSass: typeof import("sass") = load("sass");
  const { compileString, renderSync } = nodeSass;

  // 应用 additionalData（注入公共变量等）
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
      // 旧 API（向后兼容）
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

    // 合并 source map
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

<KawaikoNote variant="warning" title="API 兼容性">

Sass 有两套 API：旧版和新版．
`compileString` 是新 API，`renderSync` 是旧 API．
同时支持两者确保与任何 Sass 版本兼容．

</KawaikoNote>

### Sass 预处理器

Sass 使用与 SCSS 相同的引擎，但使用基于缩进的语法．

```ts
const sass: StylePreprocessor = (source, map, options, load) =>
  scss(
    source,
    map,
    {
      ...options,
      indentedSyntax: true,  // 启用缩进语法
    },
    load,
  );
```

### Less 预处理器

```ts
const less: StylePreprocessor = (source, map, options, load = require) => {
  const nodeLess = load("less");

  let result: any;
  let error: Error | null = null;

  // Less 的 render 是异步的，但 syncImport: true 使其同步
  nodeLess.render(
    getSource(source, options.filename, options.additionalData),
    { ...options, syncImport: true },
    (err: Error | null, output: any) => {
      error = err;
      result = output;
    },
  );

  if (error) return { code: "", errors: [error], dependencies: [] };

  // Less 通过 imports 属性返回依赖
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

### Stylus 预处理器

```ts
const styl: StylePreprocessor = (source, map, options, load = require) => {
  const nodeStylus = load("stylus");

  try {
    const ref = nodeStylus(source, options);

    // 配置 source map
    if (map) ref.set("sourcemap", { inline: false, comment: false });

    const result = ref.render();
    const dependencies = ref.deps();  // 获取依赖

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

## 使用 additionalData 注入公共样式

`additionalData` 选项允许你向所有样式文件注入公共代码．

```ts
function getSource(
  source: string,
  filename: string,
  additionalData?: string | ((source: string, filename: string) => string),
) {
  if (!additionalData) return source;

  // 如果是函数，动态生成
  if (isFunction(additionalData)) {
    return additionalData(source, filename);
  }

  // 如果是字符串，添加到源代码前面
  return additionalData + source;
}
```

使用示例（Vite 配置）：

```ts
// vite.config.ts
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        // 向所有 SCSS 文件注入变量
        additionalData: `@import "@/styles/variables.scss";`,
      },
    },
  },
});
```

<KawaikoNote variant="funny" title="注入全局变量">

`additionalData` 就像"自动复制粘贴到每个样式文件的开头"．
它省去了每次都要导入变量和混入的麻烦．

</KawaikoNote>

## 预处理器注册

```ts
export type PreprocessLang = "less" | "sass" | "scss" | "styl" | "stylus";

export const processors: Record<PreprocessLang, StylePreprocessor> = {
  less,
  sass,
  scss,
  styl,
  stylus: styl,  // 别名
};
```

## 在 compileStyle 中的集成

预处理器在 `compileStyle` 函数中被调用．

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

  // 选择预处理器
  const preprocessor = preprocessLang && processors[preprocessLang];

  // 如果存在则执行预处理器
  const preProcessedSource = preprocessor && preprocess(options, preprocessor);

  // 获取 source map（来自预处理器或输入）
  const map = preProcessedSource ? preProcessedSource.map : options.inMap;

  // CSS 源代码（转换后的或原始的）
  const source = preProcessedSource ? preProcessedSource.code : options.source;

  // 构建 PostCSS 管道
  const plugins = (postcssPlugins || []).slice();
  plugins.unshift(cssVarsPlugin({ id: shortId, isProd }));
  if (trim) plugins.push(trimPlugin());
  if (scoped) plugins.push(scopedPlugin(longId));

  // 收集依赖
  const dependencies = new Set(
    preProcessedSource ? preProcessedSource.dependencies : []
  );

  // 使用 PostCSS 处理
  const result = postcss(plugins).process(source, postCSSOptions);

  return {
    code: result.css,
    map: result.map?.toJSON(),
    errors: [...errors],
    dependencies,
  };
}
```

## 使用示例

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

## Source Map 链接

预处理器和 PostCSS 都会生成 source map．我们使用 `merge-source-map` 库来正确地链接它们．

```
SCSS 源代码
    ↓ [SCSS → CSS]
    ↓ Source map A
CSS
    ↓ [PostCSS]
    ↓ Source map B
最终 CSS
    ↓
merge(A, B) → 最终 source map
```

这使得浏览器开发工具在调试时可以显示原始 SCSS/Less/Stylus 文件的行号．

<KawaikoNote variant="surprise" title="调试更轻松！">

有了 source map，当你在浏览器中想知道"这个 CSS 是从哪里来的？"时，
你可以看到转换前原始 SCSS 文件中的确切位置．

</KawaikoNote>

## 总结

CSS 预处理器实现由以下部分组成：

1. **通用接口**：用 `StylePreprocessor` 类型抽象每个预处理器
2. **动态加载**：用 `require()` 或 `customRequire` 加载预处理器
3. **additionalData**：注入公共样式（变量，混入等）
4. **依赖追踪**：收集 `@import` 的文件以支持热重载
5. **Source map 链接**：合并预处理器和 PostCSS 的 source map
6. **PostCSS 集成**：将预处理器输出传递给 PostCSS 管道

Vue/chibivue SFC 编译器抽象了预处理器，允许用户使用他们喜欢的 CSS 语言．
