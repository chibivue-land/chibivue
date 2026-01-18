import { describe, expect, it } from "vitest";

import { compile } from "../packages/compiler-dom";
import { parse } from "../packages/compiler-sfc";

describe("10_minimum_example/070_sfc_compiler3", () => {
  it("should parse SFC with template and script blocks", () => {
    const source = `
<template>
  <div>{{ message }}</div>
</template>

<script>
export default {
  setup() {
    return { message: "hello" }
  }
}
</script>
`.trim();

    const { descriptor } = parse(source);

    expect(descriptor.template).not.toBeNull();
    expect(descriptor.template?.content).toContain("{{ message }}");

    expect(descriptor.script).not.toBeNull();
    expect(descriptor.script?.content).toContain('message: "hello"');
  });

  it("should compile template for non-browser mode", () => {
    const template = `<div>{{ count }}</div>`;
    const code = compile(template, { isBrowser: false });

    expect(code).toContain("function render");
    expect(code).toContain("_ctx.count");
    expect(code).not.toContain("with (_ctx)");
  });

  it("should compile template for browser mode", () => {
    const template = `<div>{{ count }}</div>`;
    const code = compile(template, { isBrowser: true });

    expect(code).toContain("function render");
    expect(code).toContain("with (_ctx)");
  });
});
