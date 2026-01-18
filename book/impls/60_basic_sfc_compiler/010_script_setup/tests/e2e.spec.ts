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

  it("should parse SFC style block", () => {
    const source = `
<template>
  <div class="container">content</div>
</template>

<style>
.container {
  color: red;
}
</style>
`;

    const { descriptor } = parse(source);
    expect(descriptor.styles.length).toBe(1);
    expect(descriptor.styles[0].content).toContain(".container");
    expect(descriptor.styles[0].content).toContain("color: red");
  });

  it("should compile script block", () => {
    const source = `
<template>
  <div>Hello</div>
</template>

<script>
export default {
  data() {
    return { msg: 'hello' }
  }
}
</script>
`;

    const { descriptor } = parse(source);
    const result = compileScript(descriptor);
    expect(result.code).toContain("__sfc__");
    expect(result.code).toContain("export default __sfc__");
    expect(result.code).toContain("data()");
  });

  it("should compile full SFC", () => {
    const source = `
<template>
  <div>{{ msg }}</div>
</template>

<script>
export default {
  data() {
    return { msg: 'Hello from SFC!' }
  }
}
</script>
`;

    const result = compileSfc(source, "test.vue");
    expect(result.code).toContain("__sfc__");
    expect(result.code).toContain("render");
    expect(result.code).toContain("export default __sfc__");
  });

  it("should handle SFC without script block", () => {
    const source = `
<template>
  <div>Static content</div>
</template>
`;

    const { descriptor } = parse(source);
    const result = compileScript(descriptor);
    expect(result.code).toContain("export default {}");
  });

  it("should include styles in compiled output", () => {
    const source = `
<template>
  <div class="test">content</div>
</template>

<style>
.test { color: blue; }
</style>
`;

    const result = compileSfc(source, "test.vue");
    expect(result.code).toContain("__style__");
    expect(result.code).toContain(".test { color: blue; }");
  });

  it("should parse script setup block", () => {
    const source = `
<template>
  <div>{{ msg }}</div>
</template>

<script setup>
const msg = 'Hello from script setup!'
</script>
`;

    const { descriptor } = parse(source);
    expect(descriptor.scriptSetup).not.toBeNull();
    expect(descriptor.scriptSetup?.setup).toBe(true);
    expect(descriptor.scriptSetup?.content).toContain("const msg");
    expect(descriptor.script).toBeNull();
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
    expect(result.code).toContain("setup()");
    expect(result.code).toContain("const msg = 'Hello!'");
    expect(result.code).toContain("return { msg, count }");
  });

  it("should handle function declarations in script setup", () => {
    const source = `
<template>
  <button @click="handleClick">Click</button>
</template>

<script setup>
function handleClick() {
  console.log('clicked')
}
</script>
`;

    const { descriptor } = parse(source);
    const result = compileScript(descriptor);
    expect(result.code).toContain("setup()");
    expect(result.code).toContain("function handleClick");
    expect(result.code).toContain("return { handleClick }");
  });

  it("should preserve imports in script setup", () => {
    const source = `
<template>
  <div>{{ value }}</div>
</template>

<script setup>
import { ref } from 'vue'

const value = ref(0)
</script>
`;

    const { descriptor } = parse(source);
    const result = compileScript(descriptor);
    expect(result.code).toContain("import { ref } from 'vue'");
    expect(result.code).toContain("const value = ref(0)");
    expect(result.code).toContain("return { value }");
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
