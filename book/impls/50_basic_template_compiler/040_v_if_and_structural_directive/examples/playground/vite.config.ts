import { defineConfig } from "vite-plus";
import chibivue from "../../packages/@extensions/vite-plugin-chibivue";

export default defineConfig({
  resolve: {
    alias: {
      chibivue: `${process.cwd()}/../../packages`,
    },
  },
  plugins: [chibivue()],
});
