import { createInterface } from 'node:readline'
import { locale } from './locale'
import { isAbsolutePath, trimTrailingSlash } from './helpers'

export const getVuejsCorePathInteract = async () =>
  new Promise<string>(resolve => {
    process.stdout.write(locale.prompts.requestVuejsCorePath.$t())
    let userInputVuejsCorePath = ''
    const rl = createInterface({
      input: process.stdin,
    })
    rl.on('line', line => {
      const trimmedLine = line.trim()
      if (trimmedLine) {
        if (isAbsolutePath(trimmedLine)) {
          const trimmedPath = trimTrailingSlash(trimmedLine)
          userInputVuejsCorePath = trimmedPath
          rl.close()
          resolve(userInputVuejsCorePath)
        } else {
          process.stdout.write(`  ${locale.errors.noRelativePathInput.$t()}`)
        }
      } else {
        process.stdout.write(`  ${locale.errors.noEmptyPathInput.$t()}`)
        process.stdout.write(locale.prompts.requestVuejsCorePath.$t())
      }
    })
  })
