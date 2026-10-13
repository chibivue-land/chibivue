import { defineConfig } from "vite-plus";

export default defineConfig({
  resolve: {
    alias: {
      chibivue: `${process.cwd()}/../../packages`,
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
