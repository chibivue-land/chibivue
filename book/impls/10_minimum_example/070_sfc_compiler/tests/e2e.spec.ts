import { describe, expect, it } from "vitest";

import { compile } from "../packages/compiler-dom";

describe("10_minimum_example/070_sfc_compiler", () => {
  it("should compile basic template to render function", () => {
    const template = `<div>Hello World</div>`;
    const code = compile(template);

    expect(code).toContain("function render");
    expect(code).toContain("h(");
    expect(code).toContain('"div"');
    expect(code).toContain("Hello World");
  });

  it("should compile template with nested elements", () => {
    const template = `<div><p>Nested content</p></div>`;
    const code = compile(template);

    expect(code).toContain("function render");
    expect(code).toContain('"div"');
    expect(code).toContain('"p"');
    expect(code).toContain("Nested content");
  });

  it("should compile template with mustache interpolation", () => {
    const template = `<p>{{ message }}</p>`;
    const code = compile(template);

    expect(code).toContain("function render");
    expect(code).toContain("with (_ctx)");
    expect(code).toContain("message");
  });
});
