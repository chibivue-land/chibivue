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
    expect(result.code).toContain("setup(__props)");
    expect(result.code).toContain("const msg = 'Hello!'");
    expect(result.code).toContain("return { msg, count }");
  });

  it("should track bindings from script setup", () => {
    const source = `
<template>
  <div>{{ msg }}</div>
</template>

<script setup>
const msg = 'test'
let count = 0
</script>
`;

    const { descriptor } = parse(source);
    const result = compileScript(descriptor);
    expect(result.bindings).toBeDefined();
    expect(result.bindings?.msg).toBe("setup-const");
    expect(result.bindings?.count).toBe("setup-let");
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

  it("should compile standalone defineProps call", () => {
    const source = `
<template>
  <div>content</div>
</template>

<script setup>
defineProps(['message'])
</script>
`;

    const { descriptor } = parse(source);
    const result = compileScript(descriptor);
    expect(result.code).toContain("props: ['message']");
    expect(result.bindings?.message).toBe("props");
  });

  it("should work with other bindings", () => {
    const source = `
<template>
  <div>{{ msg }} - {{ count }}</div>
</template>

<script setup>
const props = defineProps(['msg'])
const count = 0

function handleClick() {
  console.log('clicked')
}
</script>
`;

    const { descriptor } = parse(source);
    const result = compileScript(descriptor);
    expect(result.code).toContain("props: ['msg']");
    expect(result.code).toContain("const count = 0");
    expect(result.code).toContain("function handleClick");
    expect(result.code).toContain("return { count, handleClick }");
    expect(result.bindings?.msg).toBe("props");
    expect(result.bindings?.count).toBe("setup-const");
    expect(result.bindings?.handleClick).toBe("setup-const");
  });
});
