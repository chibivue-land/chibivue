import fs from 'node:fs'

export const isAbsolutePath = (path: string) =>
  path.startsWith('/') || path.startsWith('C:\\')

export const trimTrailingSlash = (path: string) =>
  path.endsWith('/') ? path.slice(0, -1) : path

export const listFiles = (dir: string): string[] =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap(dirent =>
      dirent.isFile()
        ? [`${dir}/${dirent.name}`]
        : listFiles(`${dir}/${dirent.name}`),
    )
