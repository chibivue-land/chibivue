import { defineConfig } from "vite";
import Vue from "@vitejs/plugin-vue";
import * as Compiler from "@vue/compiler-core";
import * as CompilerSFC from "@vue/compiler-sfc";
import { DevPlugin } from "./setup/dev";

export default defineConfig({
  build: {
    target: "esnext",
  },
  clearScreen: false,
  plugins: [Vue({ template: Compiler as any, compiler: CompilerSFC }), DevPlugin()],
});
