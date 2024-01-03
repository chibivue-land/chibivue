import fs from 'fs'
import fse from 'fs-extra'

const red = (s: string) => `\x1b[31m${s}\x1b[0m`
const green = (s: string) => `\x1b[32m${s}\x1b[0m`
const blue = (s: string) => `\x1b[34m${s}\x1b[0m`

const targetDirPath = 'example/playground'

// check if target path is empty
if (!targetDirPath) {
  console.log('Please specify the target path!')
  process.exit(1)
}

// check if target path exists. auto create if not
if (fs.existsSync(targetDirPath)) {
  const files = fs.readdirSync(targetDirPath)
  if (files.length) {
    console.log('')
    console.log(`${red('Oops!')} Target directory is not empty!`)
    console.log('')
    process.exit(1)
  }
} else {
  fs.mkdirSync(targetDirPath, { recursive: true })
}

// copy template files
const templateDirPath = `tools/chibivue-playground/template`
fse.copySync(templateDirPath, targetDirPath)

// message
console.log('')
console.log('----------------------------------------------------------')
console.log(
  `${green('chibivue project created!')} ${blue('>>>')} ${targetDirPath}`,
)
console.log(`Enjoy your learning! 😎`)
console.log('----------------------------------------------------------')
