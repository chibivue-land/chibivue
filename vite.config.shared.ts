import path from "node:path";
import { defineConfig } from "vite";
// @ts-expect-error - dts outputs hashed filenames
import Chibivue from "./packages/@extensions/vite-plugin-chibivue/dist";

const resolve = (p: string) => path.resolve(import.meta.dirname, "packages", p);

export default defineConfig({
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
