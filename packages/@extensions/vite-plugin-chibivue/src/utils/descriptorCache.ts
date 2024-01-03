import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { SFCDescriptor } from '@chibivue/compiler-sfc'

import { ResolvedOptions } from '..'

// compiler-sfc should be exported so it can be re-used
export interface SFCParseResult {
  descriptor: SFCDescriptor
}

const cache = new Map<string, SFCDescriptor>()
const prevCache = new Map<string, SFCDescriptor | undefined>()

export function createDescriptor(
  filename: string,
  source: string,
  { root, compiler }: ResolvedOptions,
): SFCParseResult {
  const { descriptor } = compiler.parse(source, { filename })

  const normalizedPath = path.normalize(path.relative(root, filename))
  descriptor.id = getHash(normalizedPath)

  cache.set(filename, descriptor)
  return { descriptor }
}

export function getPrevDescriptor(filename: string): SFCDescriptor | undefined {
  return prevCache.get(filename)
}

export function setPrevDescriptor(
  filename: string,
  entry: SFCDescriptor,
): void {
  prevCache.set(filename, entry)
}

export function getDescriptor(
  filename: string,
  options: ResolvedOptions,
  createIfNotFound = true,
): SFCDescriptor | undefined {
  if (cache.has(filename)) {
    return cache.get(filename)!
  }
  if (createIfNotFound) {
    const { descriptor } = createDescriptor(
      filename,
      fs.readFileSync(filename, 'utf-8'),
      options,
    )
    return descriptor
  }
}

function getHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').substring(0, 8)
}
