# CSS Preprocessors

## What are Preprocessors?

CSS preprocessors are tools that transform extended CSS languages (SCSS, Less, Stylus, etc.) into standard CSS. These languages provide features like variables, nesting, mixins, and functions, making CSS writing more efficient.

<KawaikoNote variant="question" title="Why use preprocessors?">

Plain CSS has several limitations:
- No variables (CSS custom properties were added later)
- No nesting
- Code reuse is difficult

Preprocessors solve these problems and enable writing maintainable stylesheets.

</KawaikoNote>

In Vue SFC, you can use preprocessors by specifying the `lang` attribute on the `<style>` block.

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

## Supported Preprocessors

Vue/chibivue supports the following preprocessors:

| Preprocessor | lang attribute | Features |
|--------------|---------------|----------|
| **SCSS** | `scss` | CSS-like syntax, variables, nesting, mixins |
| **Sass** | `sass` | Indent-based syntax (no braces) |
| **Less** | `less` | Variables (`@`), mixins, functions |
| **Stylus** | `styl`, `stylus` | Flexible syntax, optional delimiters |

## Type Definitions

### StylePreprocessor

A common interface for preprocessors.

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

A type representing preprocessor results.

```ts
export interface StylePreprocessorResults {
  code: string;           // Transformed CSS
  map?: object;          // Source map
  errors: Error[];       // Error list
  dependencies: string[]; // Dependency files (@import, etc.)
}
```

`dependencies` is important. It enables tools like Vite to trigger rebuilds when files imported via `@import` in the preprocessor change.

## Processing Flow

```
SFC file (.vue)
    ↓
[SFC Parser] - Detects <style lang="scss">
    ↓
[compileStyle]
    ↓
1. Select preprocessor
   processors[preprocessLang] → scss preprocessor
    ↓
2. Transform with preprocessor
   SCSS/Sass/Less/Stylus → CSS
    ↓
3. PostCSS pipeline
   ├── cssVarsPlugin (v-bind processing)
   ├── trimPlugin (whitespace removal)
   └── scopedPlugin (scoped CSS)
    ↓
4. Return result
   { code, map, errors, dependencies }
```

## Preprocessor Implementations

### SCSS Preprocessor

```ts
// style/preprocessors.ts
const scss: StylePreprocessor = (source, map, options, load = require) => {
  // Dynamically load Dart Sass library
  const nodeSass: typeof import("sass") = load("sass");
  const { compileString, renderSync } = nodeSass;

  // Apply additionalData (inject common variables, etc.)
  const data = getSource(source, options.filename, options.additionalData);

  let css: string;
  let dependencies: string[];
  let sourceMap: any;

  try {
    if (compileString) {
      // New API (Sass 1.55.0+)
      const result = compileString(data, {
        ...options,
        url: pathToFileURL(options.filename),
        sourceMap: !!map,
      });
      css = result.css;
      dependencies = result.loadedUrls.map((url) => fileURLToPath(url));
      sourceMap = map ? result.sourceMap! : undefined;
    } else {
      // Legacy API (backward compatibility)
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

    // Merge source maps
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

<KawaikoNote variant="warning" title="API Compatibility">

Sass has two APIs: old and new.
`compileString` is the new API, and `renderSync` is the old API.
Supporting both ensures compatibility with any Sass version.

</KawaikoNote>

### Sass Preprocessor

Sass uses the same engine as SCSS but uses indent-based syntax.

```ts
const sass: StylePreprocessor = (source, map, options, load) =>
  scss(
    source,
    map,
    {
      ...options,
      indentedSyntax: true,  // Enable indented syntax
    },
    load,
  );
```

### Less Preprocessor

```ts
const less: StylePreprocessor = (source, map, options, load = require) => {
  const nodeLess = load("less");

  let result: any;
  let error: Error | null = null;

  // Less render is async, but syncImport: true makes it synchronous
  nodeLess.render(
    getSource(source, options.filename, options.additionalData),
    { ...options, syncImport: true },
    (err: Error | null, output: any) => {
      error = err;
      result = output;
    },
  );

  if (error) return { code: "", errors: [error], dependencies: [] };

  // Less returns dependencies via imports property
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

### Stylus Preprocessor

```ts
const styl: StylePreprocessor = (source, map, options, load = require) => {
  const nodeStylus = load("stylus");

  try {
    const ref = nodeStylus(source, options);

    // Configure source map
    if (map) ref.set("sourcemap", { inline: false, comment: false });

    const result = ref.render();
    const dependencies = ref.deps();  // Get dependencies

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

## Injecting Common Styles with additionalData

The `additionalData` option allows you to inject common code into all style files.

```ts
function getSource(
  source: string,
  filename: string,
  additionalData?: string | ((source: string, filename: string) => string),
) {
  if (!additionalData) return source;

  // If function, generate dynamically
  if (isFunction(additionalData)) {
    return additionalData(source, filename);
  }

  // If string, prepend to source
  return additionalData + source;
}
```

Example usage (Vite config):

```ts
// vite.config.ts
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        // Inject variables into all SCSS files
        additionalData: `@import "@/styles/variables.scss";`,
      },
    },
  },
});
```

<KawaikoNote variant="funny" title="Injecting Global Variables">

`additionalData` is like "automatically copy-pasting to the beginning of every style file."
It saves you from having to import variables and mixins every time.

</KawaikoNote>

## Preprocessor Registration

```ts
export type PreprocessLang = "less" | "sass" | "scss" | "styl" | "stylus";

export const processors: Record<PreprocessLang, StylePreprocessor> = {
  less,
  sass,
  scss,
  styl,
  stylus: styl,  // alias
};
```

## Integration in compileStyle

Preprocessors are called within the `compileStyle` function.

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

  // Select preprocessor
  const preprocessor = preprocessLang && processors[preprocessLang];

  // Execute preprocessor if present
  const preProcessedSource = preprocessor && preprocess(options, preprocessor);

  // Get source map (from preprocessor or input)
  const map = preProcessedSource ? preProcessedSource.map : options.inMap;

  // CSS source (transformed or original)
  const source = preProcessedSource ? preProcessedSource.code : options.source;

  // Build PostCSS pipeline
  const plugins = (postcssPlugins || []).slice();
  plugins.unshift(cssVarsPlugin({ id: shortId, isProd }));
  if (trim) plugins.push(trimPlugin());
  if (scoped) plugins.push(scopedPlugin(longId));

  // Collect dependencies
  const dependencies = new Set(
    preProcessedSource ? preProcessedSource.dependencies : []
  );

  // Process with PostCSS
  const result = postcss(plugins).process(source, postCSSOptions);

  return {
    code: result.css,
    map: result.map?.toJSON(),
    errors: [...errors],
    dependencies,
  };
}
```

## Usage Examples

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

## Source Map Chaining

Both preprocessors and PostCSS generate source maps. We use the `merge-source-map` library to properly chain them.

```
SCSS source
    ↓ [SCSS → CSS]
    ↓ Source map A
CSS
    ↓ [PostCSS]
    ↓ Source map B
Final CSS
    ↓
merge(A, B) → Final source map
```

This allows browser DevTools to show line numbers from the original SCSS/Less/Stylus files when debugging.

<KawaikoNote variant="surprise" title="Debugging made easier!">

With source maps, when you wonder "where did this CSS come from?" in the browser,
you can see the exact location in the original SCSS file before transformation.

</KawaikoNote>

## Summary

The CSS preprocessor implementation consists of:

1. **Common interface**: Abstract each preprocessor with the `StylePreprocessor` type
2. **Dynamic loading**: Load preprocessors with `require()` or `customRequire`
3. **additionalData**: Inject common styles (variables, mixins, etc.)
4. **Dependency tracking**: Collect `@import`ed files for hot reload support
5. **Source map chaining**: Merge preprocessor and PostCSS source maps
6. **PostCSS integration**: Pass preprocessor output to PostCSS pipeline

The Vue/chibivue SFC compiler abstracts preprocessors, allowing users to use their preferred CSS language.
