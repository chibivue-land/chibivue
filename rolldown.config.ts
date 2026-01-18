import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";

const PACKAGES = [
  "chibivue",
  "compiler-core",
  "compiler-dom",
  "compiler-sfc",
  "compiler-vapor",
  "runtime-core",
  "runtime-dom",
  "runtime-vapor",
  "server-renderer",
  "reactivity",
  "shared",
  "@extensions/chibivue-router",
  "@extensions/chibivue-store",
  "@extensions/vite-plugin-chibivue",
];

export default defineConfig(
  PACKAGES.map((pkg) => ({
    input: `impl/${pkg}/src/index.ts`,
    output: {
      dir: `impl/${pkg}/dist`,
      format: "esm",
      entryFileNames: "index.js",
    },
    external: pkg === "@extensions/vite-plugin-chibivue" ? ["vite"] : [],
    plugins: [dts()],
  })),
);
