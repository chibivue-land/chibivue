import { describe, expect, it } from "vitest";

import { compile } from "../packages/compiler-dom";
import { parse, rewriteDefault } from "../packages/compiler-sfc";

describe("10_minimum_example/070_sfc_compiler4", () => {
  it("should parse SFC with template, script, and style blocks", () => {
    const source = `
<template>
  <div class="container">{{ message }}</div>
</template>

<script>
export default {
  setup() {
    return { message: "hello" }
  }
}
</script>

<style>
.container { color: blue; }
</style>
`.trim();

    const { descriptor } = parse(source);

    expect(descriptor.template).not.toBeNull();
    expect(descriptor.template?.content).toContain("class=\"container\"");

    expect(descriptor.script).not.toBeNull();
    expect(descriptor.script?.content).toContain("export default");

    expect(descriptor.styles.length).toBe(1);
    expect(descriptor.styles[0].content).toContain(".container");
  });

  it("should rewrite default export", () => {
    const input = `export default { setup() { return {} } }`;
    const result = rewriteDefault(input, "_sfc_main");

    expect(result).toContain("const _sfc_main =");
    expect(result).not.toContain("export default");
  });

  it("should handle missing default export", () => {
    const input = `const foo = 1;`;
    const result = rewriteDefault(input, "_sfc_main");

    expect(result).toContain("const _sfc_main = {}");
  });

  it("should compile template with attributes", () => {
    const template = `<div class="box" id="main">content</div>`;
    const code = compile(template, { isBrowser: false });

    expect(code).toContain("function render");
    expect(code).toContain('"div"');
    expect(code).toContain("class");
    expect(code).toContain("box");
  });

  it("should compile nested elements", () => {
    const template = `<div><span>nested</span></div>`;
    const code = compile(template, { isBrowser: false });

    expect(code).toContain('"div"');
    expect(code).toContain('"span"');
    expect(code).toContain("nested");
  });
});
