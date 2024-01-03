import * as _compiler from '@chibivue/compiler-sfc'

import type { Plugin } from 'vite'
import { createFilter } from 'vite'
import { transformMain } from './main'
import { parseChibiVueRequest } from './utils/query'
import { getDescriptor } from './utils/descriptorCache'

export interface ResolvedOptions {
  compiler: typeof _compiler
  root: string
}

export default function chibiVuePlugin(): Plugin {
  const filter = createFilter(/\.vue$/)
  const options: ResolvedOptions = {
    compiler: _compiler,
    root: process.cwd(),
  }

  return {
    name: 'vite:chibivue',

    // virtual modules
    resolveId(id) {
      if (parseChibiVueRequest(id).query.chibivue) return id
    },
    load(id) {
      const { filename, query } = parseChibiVueRequest(id)
      if (query.chibivue) {
        const descriptor = getDescriptor(filename, options)!
        if (query.type === 'style')
          return { code: descriptor.styles[query.index!].content }
      }
    },

    transform(code, id, _) {
      if (!filter(id)) return
      return transformMain(code, id, options)
    },
  }
}
