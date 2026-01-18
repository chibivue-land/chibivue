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
});

describe("60_basic_sfc_compiler/050_props_destructure", () => {
  // Props destructure is a Vue 3.5 feature
  // This is a placeholder for future implementation
  // See the book chapter for implementation details

  it.skip("should handle props destructure with default values", () => {
    const source = `
<template>
  <p>{{ count }} - {{ message }}</p>
</template>

<script setup>
const { count, message = 'default' } = defineProps({
  count: Number,
  message: String
})
</script>
`;

    const { descriptor } = parse(source);
    const result = compileScript(descriptor);
    // When implemented, destructured props should be transformed to __props.xxx
    expect(result.code).toContain("__props.count");
    expect(result.code).toContain("__props.message");
  });

  it.skip("should register destructured props as PROPS bindings", () => {
    const source = `
<template>
  <p>{{ count }}</p>
</template>

<script setup>
const { count } = defineProps(['count'])
</script>
`;

    const { descriptor } = parse(source);
    const result = compileScript(descriptor);
    expect(result.bindings?.count).toBe("props");
  });
});
