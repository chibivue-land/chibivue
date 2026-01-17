import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";

const PACKAGES = [
  "chibivue",
  "compiler-core",
  "compiler-dom",
  "compiler-sfc",
  "runtime-core",
  "runtime-dom",
  "runtime-vapor",
  "reactivity",
  "shared",
  "@extensions/chibivue-router",
  "@extensions/chibivue-store",
  "@extensions/vite-plugin-chibivue",
];

export default defineConfig(
  PACKAGES.map((pkg) => ({
    input: `packages/${pkg}/src/index.ts`,
    output: {
      dir: `packages/${pkg}/dist`,
      format: "esm",
      entryFileNames: "index.js",
    },
    external: pkg === "@extensions/vite-plugin-chibivue" ? ["vite"] : [],
    plugins: [dts()],
  })),
);
