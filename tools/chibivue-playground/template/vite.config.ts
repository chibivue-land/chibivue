import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// @ts-expect-error
import Chibivue from "../../packages/@extensions/vite-plugin-chibivue/dist";

const dirname = path.dirname(fileURLToPath(new URL(import.meta.url)));
const resolve = (p: string) => path.resolve(dirname, "../../packages", p);

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
      "vite-plugin-chibivue": resolve("@extensions/vite-plugin-chibivue/src"),
    },
  },
  plugins: [Chibivue()],
});
