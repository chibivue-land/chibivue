import { describe, expect, it } from "vitest";

import { compile } from "../packages/compiler-dom";
import { parse } from "../packages/compiler-sfc";

describe("10_minimum_example/070_sfc_compiler2", () => {
  it("should parse SFC with template, script, and style blocks", () => {
    const source = `
<template>
  <div>Hello</div>
</template>

<script>
export default {
  setup() {
    return {}
  }
}
</script>

<style>
div { color: red; }
</style>
`.trim();

    const { descriptor } = parse(source);

    expect(descriptor.template).not.toBeNull();
    expect(descriptor.template?.content).toContain("<div>Hello</div>");

    expect(descriptor.script).not.toBeNull();
    expect(descriptor.script?.content).toContain("export default");

    expect(descriptor.styles.length).toBe(1);
    expect(descriptor.styles[0].content).toContain("color: red");
  });

  it("should compile template to render function code", () => {
    const template = `<div>Hello</div>`;
    const code = compile(template);

    expect(code).toContain("function render");
    expect(code).toContain("h(");
    expect(code).toContain('"div"');
    expect(code).toContain("Hello");
  });

  it("should compile template with interpolation", () => {
    const template = `<p>{{ message }}</p>`;
    const code = compile(template);

    expect(code).toContain("function render");
    expect(code).toContain("with (_ctx)");
    expect(code).toContain("message");
  });
});
