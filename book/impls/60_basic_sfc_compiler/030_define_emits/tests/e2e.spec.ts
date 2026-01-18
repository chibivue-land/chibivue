import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp, h } from "../packages";
import { parse, compileScript, compileSfc } from "../packages/compiler-sfc";

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
    expect(result.bindings?.title).toBe("props");
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

  it("should compile defineEmits with object syntax", () => {
    const source = `
<template>
  <button @click="handleClick">Click</button>
</template>

<script setup>
const emit = defineEmits({
  click: null,
  update: (value) => typeof value === 'string'
})
</script>
`;

    const { descriptor } = parse(source);
    const result = compileScript(descriptor);
    expect(result.code).toContain("emits:");
    expect(result.code).toContain("click: null");
    expect(result.code).toContain("const emit = __emit");
  });

  it("should compile standalone defineEmits call", () => {
    const source = `
<template>
  <button>Click</button>
</template>

<script setup>
defineEmits(['submit'])
</script>
`;

    const { descriptor } = parse(source);
    const result = compileScript(descriptor);
    expect(result.code).toContain("emits: ['submit']");
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
    expect(result.code).toContain("function handleClick");
    expect(result.bindings?.label).toBe("props");
    expect(result.bindings?.emit).toBe("setup-const");
    expect(result.bindings?.handleClick).toBe("setup-const");
  });

  it("should include emit in setup context", () => {
    const source = `
<template>
  <div>content</div>
</template>

<script setup>
const emit = defineEmits(['change'])
</script>
`;

    const { descriptor } = parse(source);
    const result = compileScript(descriptor);
    expect(result.code).toContain("setup(__props, { emit: __emit })");
  });
});
