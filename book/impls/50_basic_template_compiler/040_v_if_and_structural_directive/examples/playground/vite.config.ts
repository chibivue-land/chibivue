import { defineConfig } from 'vite'
import chibivue from '../../packages/@extensions/vite-plugin-chibivue'

export default defineConfig({
  resolve: {
    alias: {
      chibivue: `${process.cwd()}/../../packages`,
    },
  },
  plugins: [chibivue()],
})
