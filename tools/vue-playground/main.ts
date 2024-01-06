import fs from 'node:fs'
import path from 'node:path'

import { fileURLToPath } from 'node:url'

import { t } from 'chainsi'
import { locale } from './locale'
import { getVuejsCorePathInteract } from './prompt'
import { generate } from './generate'

const TARGET_DIR_PATH = 'examples/vuejs-core'
const dirname = path.dirname(fileURLToPath(new URL(import.meta.url)))

await (async function main() {
  checkTargetDirExist()
  const templateVars = new Map<string, string>()
  const userInputVuejsCorePath = await getVuejsCorePathInteract()
  templateVars.set('vuejs_core_absolute_path', userInputVuejsCorePath)
  const templateDirPath = path.resolve(dirname, './template')
  await generate(templateDirPath, TARGET_DIR_PATH, templateVars)
  console.log(locale.success.generate.$t(`./${TARGET_DIR_PATH}`))
})()

function checkTargetDirExist() {
  if (fs.existsSync(TARGET_DIR_PATH)) {
    const files = fs.readdirSync(TARGET_DIR_PATH)
    if (files.length) {
      console.log(`\n${locale.errors.targetDirHasAlreadyExist.$t()}\n`)
      process.exit(1)
    }
  } else {
    fs.mkdirSync(TARGET_DIR_PATH, { recursive: true })
  }
}
