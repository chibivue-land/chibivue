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
  it("should compile defineProps with object syntax", () => {
    const source = `
<template>
  <div>{{ title }}</div>
</template>

<script setup>
const props = defineProps({
  title: String,
  count: Number
})
</script>
`;

    const { descriptor } = parse(source);
    const result = compileScript(descriptor);
    expect(result.code).toContain("props:");
    expect(result.code).toContain("title: String");
    expect(result.code).toContain("count: Number");
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
});

describe("60_basic_sfc_compiler/040_scoped_css", () => {
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

describe("60_basic_sfc_compiler/050_props_destructure", () => {
  it.skip("should handle props destructure", () => {
    // Placeholder for props destructure implementation
  });
});

describe("60_basic_sfc_compiler/060_type_based_macros", () => {
  // Type-based defineEmits

  it("should compile type-based defineEmits with function overload format", () => {
    const source = `
<template>
  <button @click="handleClick">Click</button>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  (e: 'change', value: string): void
  (e: 'update', id: number): void
}>()

function handleClick() {
  emit('change', 'test')
}
</script>
`;

    const { descriptor } = parse(source);
    const result = compileScript(descriptor);
    expect(result.code).toContain("emits:");
    expect(result.code).toContain("'change'");
    expect(result.code).toContain("'update'");
  });

  it("should compile type-based defineEmits with object format", () => {
    const source = `
<template>
  <button @click="handleClick">Click</button>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  change: [value: string]
  update: [id: number]
}>()

function handleClick() {
  emit('change', 'test')
}
</script>
`;

    const { descriptor } = parse(source);
    const result = compileScript(descriptor);
    expect(result.code).toContain("emits:");
    expect(result.code).toContain("'change'");
    expect(result.code).toContain("'update'");
  });

  it.skip("should compile type-based defineProps", () => {
    const source = `
<template>
  <div>{{ count }}</div>
</template>

<script setup lang="ts">
const props = defineProps<{
  count: number
  message?: string
}>()
</script>
`;

    const { descriptor } = parse(source);
    const result = compileScript(descriptor);
    // When implemented, TypeScript types should be converted to runtime props
    expect(result.code).toContain("props:");
    expect(result.code).toContain("type: Number");
    expect(result.code).toContain("required: true");
  });

  it.skip("should handle withDefaults for type-based props", () => {
    const source = `
<template>
  <div>{{ message }}</div>
</template>

<script setup lang="ts">
interface Props {
  count: number
  message?: string
}

const props = withDefaults(defineProps<Props>(), {
  message: 'default message'
})
</script>
`;

    const { descriptor } = parse(source);
    const result = compileScript(descriptor);
    // When implemented, withDefaults should merge default values
    expect(result.code).toContain("default: 'default message'");
  });
});
