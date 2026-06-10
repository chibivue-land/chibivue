import path from "node:path";
import { defineConfig } from "vite-plus";
import type { UserConfig } from "vite-plus";
import Chibivue from "./impl/@extensions/vite-plugin-chibivue/src";

const resolve = (p: string) => path.resolve(import.meta.dirname, "impl", p);

const config: UserConfig = defineConfig({
  resolve: {
    alias: {
      chibivue: resolve("chibivue/src"),
      "@chibivue/runtime-core": resolve("runtime-core/src"),
      "@chibivue/runtime-dom": resolve("runtime-dom/src"),
      "@chibivue/runtime-vapor": resolve("runtime-vapor/src"),
      "@chibivue/reactivity": resolve("reactivity/src"),
      "@chibivue/shared": resolve("shared/src"),
      "@chibivue/compiler-core": resolve("compiler-core/src"),
      "@chibivue/compiler-dom": resolve("compiler-dom/src"),
      "@chibivue/compiler-sfc": resolve("compiler-sfc/src"),
      "chibivue-router": resolve("@extensions/chibivue-router/src"),
      "chibivue-store": resolve("@extensions/chibivue-store/src"),
    },
  },
  plugins: [Chibivue()],
});

export default config;
