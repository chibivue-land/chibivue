import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      dev: { command: "vp run playground#dev", cache: false },
    },
  },
});
