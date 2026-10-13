import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

const dirname = path.dirname(fileURLToPath(new URL(import.meta.url)));

export default defineConfig({
  resolve: {
    alias: {
      chibivue: path.resolve(dirname, "../../packages"),
    },
  },
  run: {
    tasks: {
      dev: { command: "vp dev", cache: false },
      build: "vp build",
      preview: { command: "vp preview", dependsOn: ["build"], cache: false },
    },
  },
});
