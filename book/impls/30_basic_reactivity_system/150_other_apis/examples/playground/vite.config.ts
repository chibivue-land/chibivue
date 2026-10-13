import { defineConfig } from "vite-plus";
import chibivue from "../../packages/@extensions/vite-plugin-chibivue";

export default defineConfig({
  resolve: {
    alias: {
      chibivue: `${process.cwd()}/../../packages`,
    },
  },
  plugins: [chibivue()],
  run: {
    tasks: {
      dev: { command: "vp dev", cache: false },
      build: "vp build",
      preview: { command: "vp preview", dependsOn: ["build"], cache: false },
    },
  },
});
