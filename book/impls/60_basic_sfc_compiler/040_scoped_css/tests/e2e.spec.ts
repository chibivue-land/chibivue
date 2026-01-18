import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp, h } from "../packages";
import { parse, compileScript, compileStyle, compileSfc } from "../packages/compiler-sfc";

let host: HTMLElement;
const initHost = () => {
  host = document.createElement("div");
  host.setAttribute("id", "host");
  document.body.appendChild(host);
};
beforeEach(() => initHost());
afterEach(() => host.remove());

describe("60_basic_sfc_compiler/010_script_setup", () => {
  it("should parse SFC template block", () => {
    const source = `
<template>
  <div>Hello SFC!</div>
</template>

<script>
export default {
  name: 'HelloWorld'
}
</script>
`;

    const { descriptor } = parse(source);
    expect(descriptor.template).not.toBeNull();
    expect(descriptor.template?.content).toContain("<div>Hello SFC!</div>");
    expect(descriptor.script).not.toBeNull();
    expect(descriptor.script?.content).toContain("name: 'HelloWorld'");
  });

  it("should compile script setup to setup function", () => {
    const source = `
<template>
  <div>{{ msg }}</div>
</template>

<script setup>
const msg = 'Hello!'
const count = 0
</script>
`;

    const { descriptor } = parse(source);
    const result = compileScript(descriptor);
    expect(result.code).toContain("setup(__props, { emit: __emit })");
    expect(result.code).toContain("const msg = 'Hello!'");
    expect(result.code).toContain("return { msg, count }");
  });
});

describe("60_basic_sfc_compiler/020_define_props", () => {
  it("should compile defineProps with array syntax", () => {
    const source = `
<template>
  <div>{{ msg }}</div>
</template>

<script setup>
const props = defineProps(['msg', 'count'])
</script>
`;

    const { descriptor } = parse(source);
    const result = compileScript(descriptor);
    expect(result.code).toContain("props: ['msg', 'count']");
    expect(result.code).toContain("const props = __props");
    expect(result.bindings?.msg).toBe("props");
    expect(result.bindings?.count).toBe("props");
  });
});

describe("60_basic_sfc_compiler/030_define_emits", () => {
  it("should compile defineEmits with array syntax", () => {
    const source = `
<template>
  <button @click="handleClick">Click</button>
</template>

<script setup>
const emit = defineEmits(['click', 'update'])
</script>
`;

    const { descriptor } = parse(source);
    const result = compileScript(descriptor);
    expect(result.code).toContain("emits: ['click', 'update']");
    expect(result.code).toContain("const emit = __emit");
  });

  it("should work with defineProps and defineEmits together", () => {
    const source = `
<template>
  <button @click="handleClick">{{ label }}</button>
</template>

<script setup>
const props = defineProps(['label'])
const emit = defineEmits(['click'])

function handleClick() {
  emit('click')
}
</script>
`;

    const { descriptor } = parse(source);
    const result = compileScript(descriptor);
    expect(result.code).toContain("props: ['label']");
    expect(result.code).toContain("emits: ['click']");
    expect(result.code).toContain("const props = __props");
    expect(result.code).toContain("const emit = __emit");
  });
});

describe("60_basic_sfc_compiler/040_scoped_css", () => {
  it("should parse scoped style block", () => {
    const source = `
<template>
  <div class="container">content</div>
</template>

<style scoped>
.container {
  color: red;
}
</style>
`;

    const { descriptor } = parse(source);
    expect(descriptor.styles.length).toBe(1);
    expect(descriptor.styles[0].scoped).toBe(true);
  });

  it("should apply scoped transformation to CSS", () => {
    const css = `.container { color: red; }`;
    const result = compileStyle({
      source: css,
      id: "abc123",
      scoped: true,
    });

    expect(result.code).toContain("[data-v-abc123]");
    expect(result.code).toContain(".container[data-v-abc123]");
  });

  it("should not apply scoping to non-scoped styles", () => {
    const css = `.container { color: red; }`;
    const result = compileStyle({
      source: css,
      id: "abc123",
      scoped: false,
    });

    expect(result.code).not.toContain("[data-v-abc123]");
    expect(result.code).toBe(css);
  });

  it("should generate scopeId in compiled SFC", () => {
    const source = `
<template>
  <div class="test">content</div>
</template>

<style scoped>
.test { color: blue; }
</style>
`;

    const result = compileSfc(source, "test.vue");
    expect(result.scopeId).toBeDefined();
    expect(result.code).toContain("__scopeId");
    expect(result.code).toContain("[data-v-");
  });

  it("should handle multiple style blocks with mixed scoping", () => {
    const source = `
<template>
  <div class="test">content</div>
</template>

<style>
.global { color: black; }
</style>

<style scoped>
.scoped { color: blue; }
</style>
`;

    const { descriptor } = parse(source);
    expect(descriptor.styles.length).toBe(2);
    expect(descriptor.styles[0].scoped).toBe(false);
    expect(descriptor.styles[1].scoped).toBe(true);
  });

  it("should handle descendant selectors", () => {
    const css = `.parent .child { color: red; }`;
    const result = compileStyle({
      source: css,
      id: "abc123",
      scoped: true,
    });

    expect(result.code).toContain(".child[data-v-abc123]");
  });

  it("should handle ::v-slotted() selector", () => {
    const css = `::v-slotted(.foo) { color: red; }`;
    const result = compileStyle({
      source: css,
      id: "abc123",
      scoped: true,
    });

    // ::v-slotted(.foo) should become .foo[data-v-abc123-s]
    // The -s suffix indicates slotted content
    expect(result.code).toContain(".foo[data-v-abc123-s]");
    expect(result.code).not.toContain("::v-slotted");
  });

  it("should handle :slotted() selector", () => {
    const css = `:slotted(.bar) { color: blue; }`;
    const result = compileStyle({
      source: css,
      id: "test123",
      scoped: true,
    });

    expect(result.code).toContain(".bar[data-v-test123-s]");
    expect(result.code).not.toContain(":slotted");
  });

  it("should handle v-bind() in CSS values", () => {
    const css = `.container { color: v-bind(textColor); }`;
    const result = compileStyle({
      source: css,
      id: "abc123",
      scoped: true,
    });

    // v-bind(textColor) should become var(--abc123-textColor)
    expect(result.code).toContain("var(--abc123-textColor)");
    expect(result.code).not.toContain("v-bind");
    expect(result.cssVars).toContain("textColor");
  });

  it("should handle v-bind() with quoted expressions", () => {
    const css = `.container { font-size: v-bind('font.size'); }`;
    const result = compileStyle({
      source: css,
      id: "test",
      scoped: true,
    });

    // Quoted expression 'font.size' should be extracted
    expect(result.code).toContain("var(--test-font\\.size)");
    expect(result.cssVars).toContain("font.size");
  });

  it("should handle multiple v-bind() expressions", () => {
    const css = `.box { color: v-bind(color); background: v-bind(bg); }`;
    const result = compileStyle({
      source: css,
      id: "multi",
      scoped: true,
    });

    expect(result.code).toContain("var(--multi-color)");
    expect(result.code).toContain("var(--multi-bg)");
    expect(result.cssVars).toHaveLength(2);
    expect(result.cssVars).toContain("color");
    expect(result.cssVars).toContain("bg");
  });
});
