import path from 'node:path'
import { execSync } from 'node:child_process'

import { build } from 'esbuild'
import { rimraf } from 'rimraf'
import { bundle } from 'dts-bundle'
import { t } from 'chainsi'

const finishedBuild = (dir: string) =>
  console.log(`${t('✔︎').green._} build: ${t(dir).blue._}`)

const NODE_EXTERNALS = [
  'assert',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'dns',
  'domain',
  'events',
  'fs',
  'http',
  'http2',
  'https',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'sys',
  'timers',
  'tls',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'wasi',
  'worker_threads',
  'zlib',
].flatMap(name => [name, `node:${name}`])

const PACKAGES: Record<string, { external?: string[] }> = {
  chibivue: {},
  'compiler-core': {},
  'compiler-dom': {},
  'compiler-sfc': {},
  'runtime-core': {},
  'runtime-dom': {},
  'runtime-vapor': {},
  reactivity: {},
  shared: {},
  '@extensions/chibivue-router': {},
  '@extensions/chibivue-store': {},
  '@extensions/vite-plugin-chibivue': {
    external: ['vite'],
  },
}

export const buildMain = () => {
  execSync('tsc -p tsconfig.build.json')

  const promises = Object.entries(PACKAGES).map(async ([pkg, { external }]) => {
    const res = await build({
      entryPoints: [path.resolve(`packages/${pkg}/src/index`)],
      target: 'esnext',
      bundle: true,
      outdir: `packages/${pkg}/dist`,
      external: [...NODE_EXTERNALS, ...(external ?? [])],
      format: 'esm',
      plugins: [
        {
          name: 'TypeScriptDeclarationsPlugin',
          setup(build: any) {
            build.onEnd(() => {
              bundle({
                name: pkg,
                main: `temp/${pkg}/src/index.d.ts`,
                out: path.resolve(`packages/${pkg}/dist/index.d.ts`),
              })
            })
          },
        },
      ],
    })
    finishedBuild(`packages/${pkg}/dist`)
    return res
  })
  return promises
}

export const clearMain = () =>
  Object.entries(PACKAGES)
    .map(([pkg]) => `packages/${pkg}/dist`)
    .map(dir => rimraf(dir))
;(async function main() {
  console.log('clear dist...')
  await Promise.allSettled([...clearMain()])
  console.log(`${t('✔︎').green._} finished clearing dist`)
  console.log('building...')
  const buildingMain = buildMain()
  await Promise.all([...buildingMain])
  execSync('rm -rf temp')
})()
