import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

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
  run: {
    tasks: {
      "book:dev": {
        command: "vp exec vitepress dev book/online-book",
        cache: false,
      },
      "book:build": {
        command: "vp exec vitepress build book/online-book",
        output: [{ pattern: "book/online-book/.vitepress/dist/**", base: "workspace" }],
      },
      "book:preview": {
        command: "vp exec vitepress preview book/online-book",
        dependsOn: ["book:build"],
        cache: false,
      },
      "impl:bundle": {
        command: "vp exec rolldown -c",
        output: [
          { pattern: "impl/*/dist/**", base: "workspace" },
          { pattern: "impl/@extensions/*/dist/**", base: "workspace" },
        ],
      },
      "impl:clean:dist": {
        command: "vp exec rimraf impl/*/dist impl/@extensions/*/dist",
        cache: false,
      },
      "play:generate": "vp run @chibivue/book-playground#generate",
      "play:dev": {
        command: "vp run @chibivue/book-playground#dev",
        dependsOn: ["play:generate"],
        cache: false,
      },
      "text:lint": "vp exec textlint book",
      types: "vp exec tsgo --noEmit",
      "verify:static": {
        command: ["vp fmt --check .", "vp lint .", "vp run text:lint", "vp run types"],
      },
      "verify:impl": {
        command: ["vp run verify:static", "vp run impl:bundle", "vp test run"],
      },
    },
  },
});
