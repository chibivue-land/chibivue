//! Copied from [vuejs/core-vapor/playground/setup/vite.js](https://github.com/vuejs/core-vapor/blob/bdf28de8e83cc8e398768eedfc0ac932b6a334ab/playground/setup/vite.js)
import { DevPlugin } from './dev'
import { startVite } from 'vite-hyper-config'

startVite(
  undefined,
  { plugins: [DevPlugin()] },
  { deps: { inline: ['@vitejs/plugin-vue'] } },
)
