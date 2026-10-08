import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";
import { defineTasks } from "./tools/define-tasks.ts";

const IMPL_PACKAGES = [
  "chibivue",
  "compiler-core",
  "compiler-dom",
  "compiler-sfc",
  "compiler-vapor",
  "runtime-core",
  "runtime-dom",
  "runtime-vapor",
  "server-renderer",
  "reactivity",
  "shared",
  "@extensions/chibivue-router",
  "@extensions/chibivue-store",
  "@extensions/vite-plugin-chibivue",
];

const BOOK = "book/online-book";
const node = (script: string) => `node --experimental-strip-types ${script}`;

export default defineConfig({
  fmt: {
    ignorePatterns: ["**/*.md", "**/*.html", "**/*.vue", "**/*.css"],
  },
  lint: {
    ignorePatterns: ["examples/vuejs-core"],
    rules: {
      "no-unused-vars": "off",
      "no-unused-expressions": "off",
      "no-useless-escape": "off",
      "no-this-alias": "off",
      "no-async-promise-executor": "off",
      "only-used-in-recursion": "off",
      "no-non-null-asserted-optional-chain": "off",
      "no-wrapper-object-types": "off",
      "unicorn/no-new-array": "off",
      "unicorn/no-useless-spread": "off",
      "unicorn/no-useless-fallback-in-spread": "off",
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    jsPlugins: [
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],
  },
  test: {
    globals: true,
    include: ["**/tests/**/*.spec.ts"],
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
  pack: IMPL_PACKAGES.map((pkg) => {
    const isVitePlugin = pkg === "@extensions/vite-plugin-chibivue";
    return {
      name: pkg,
      entry: { index: `impl/${pkg}/src/index.ts` },
      outDir: `impl/${pkg}/dist`,
      format: "esm",
      platform: isVitePlugin ? "node" : "browser",
      fixedExtension: false,
      hash: false,
      dts: true,
      // Every package ships as a self-contained bundle, like the previous rolldown build.
      deps: {
        alwaysBundle: [/.*/],
        neverBundle: isVitePlugin ? ["vite", "vite-plus"] : [],
        onlyBundle: false,
      },
    };
  }),
  run: {
    tasks: defineTasks({
      // book
      dev: { command: `vp dev ${BOOK}`, cache: false },
      build: {
        command: `vp build ${BOOK}`,
        output: [{ pattern: `${BOOK}/dist/**`, base: "workspace" }],
      },
      preview: { command: `vp preview ${BOOK}`, dependsOn: ["build"], cache: false },

      // static checks
      fmt: { command: "vp fmt --write .", cache: false },
      "fmt:check": "vp fmt --check .",
      lint: "vp lint .",
      "lint:fix": { command: "vp lint --fix .", cache: false },
      "lint:text": "vp exec textlint book",
      types: ["vp exec tsgo --noEmit", "vp exec tsgo --noEmit -p tsconfig.config.json"],
      check: {
        command: [
          "vp fmt --check .",
          "vp lint .",
          "vp exec textlint book",
          "vp exec tsgo --noEmit",
          "vp exec tsgo --noEmit -p tsconfig.config.json",
        ],
      },

      // tests
      test: "vp test run",
      "test:watch": { command: "vp test watch", cache: false },

      // impl
      "impl:build": {
        command: "vp pack",
        output: [
          { pattern: "impl/*/dist/**", base: "workspace" },
          { pattern: "impl/@extensions/*/dist/**", base: "workspace" },
        ],
      },
      "impl:clean": {
        command: "vp exec rimraf impl/*/dist impl/@extensions/*/dist",
        cache: false,
      },
      "impl:check": { command: "vp test run", dependsOn: ["check", "impl:build"] },
      "impl:dev": { command: "vp run @chibivue/book-playground#dev", cache: false },
      "impl:dev:app": { command: "vp dev", cwd: "examples/app", cache: false },
      "impl:dev:vapor": { command: "vp dev", cwd: "examples/vapor", cache: false },
      "impl:dev:vue": {
        command: ["vp install", "vp run dev"],
        cwd: "examples/vuejs-core",
        cache: false,
      },
      "impl:size": { command: "tokei -f impl > tools/book-size/pkg/files.txt", cache: false },

      // playground
      "play:generate": "vp run @chibivue/book-playground#generate",
      play: {
        command: "vp run @chibivue/book-playground#dev",
        dependsOn: ["play:generate"],
        cache: false,
      },

      // tools
      setup: {
        command: ["vp install", node("tools/chibivue-playground/main.ts")],
        cache: false,
      },
      "setup:dev": { command: node("tools/chibivue-playground/main.ts"), cache: false },
      "setup:vue": { command: node("tools/vue-playground/main.ts"), cache: false },
      "setup:book": { command: node("tools/create-chibivue/main.ts"), cache: false },
      "count-chars": { command: node("tools/book-size/book/count-chars.ts"), cache: false },
      translate: { command: node("tools/translator/ja2en/main.ts"), cache: false },
    }),
  },
});
