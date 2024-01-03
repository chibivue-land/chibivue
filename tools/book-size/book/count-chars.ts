import fs from 'fs'

const listFiles = (dir: string): string[] =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap(dirent =>
      dirent.isFile()
        ? [`${dir}/${dirent.name}`]
        : listFiles(`${dir}/${dirent.name}`),
    )

const countBookSize = (files: string[]): number =>
  files.reduce((acc, file) => {
    if (file.endsWith('.md')) {
      const content = fs.readFileSync(file, 'utf-8')
      const size = content.length
      return acc + size
    }
    return acc
  }, 0)

;(function main() {
  const ROOT = 'book/online-book/src'
  const IGNORES = ['en', '__wip']
  const OUT = 'tools/book-size/book/char-counts.json'
  const files = listFiles(ROOT).filter(
    file => !IGNORES.some(ignore => file.split('/').includes(ignore)),
  )
  const bookSize = countBookSize(files)
  const json = JSON.stringify({ length: bookSize })
  fs.writeFileSync(OUT, json)
})()
