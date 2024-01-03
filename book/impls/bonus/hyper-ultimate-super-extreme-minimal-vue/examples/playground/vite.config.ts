import { VitePluginChibivue } from '../../packages'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      'hyper-ultimate-super-extreme-minimal-vue': `${process.cwd()}/../../packages`,
    },
  },
  plugins: [VitePluginChibivue()],
})
