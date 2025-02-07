import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

import { VitePluginChibivue } from '../../packages'

const dirname = path.dirname(fileURLToPath(new URL(import.meta.url)))
export default defineConfig({
  resolve: {
    alias: {
      'hyper-ultimate-super-extreme-minimal-vue': path.resolve(
        dirname,
        '../../packages',
      ),
    },
  },
  plugins: [VitePluginChibivue()],
})
