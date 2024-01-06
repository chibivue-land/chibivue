import fs from 'node:fs/promises'
import { listFiles } from './helpers'
import fse from 'fs-extra'

export const generate = (
  templateDirPath: string,
  targetDirPath: string,
  vars: Map<string, string>,
): Promise<void> =>
  new Promise(async resolve => {
    fse.copySync(templateDirPath, targetDirPath)
    const templateFiles = listFiles(targetDirPath).filter(f =>
      f.endsWith('.template'),
    )
    await Promise.all(
      templateFiles.map(async templateFile => {
        const targetFile = templateFile.replace(/\.template$/, '')
        const template = await fs.readFile(templateFile, 'utf-8')
        const embeddedTemplate = embedVars(template, vars)
        await fs.writeFile(targetFile, embeddedTemplate)
        await fs.unlink(templateFile)
      }),
    )
    resolve()
  })

const embedVars = (template: string, vars: Map<string, string>): string => {
  let result = template
  vars.forEach((value, key) => {
    result = result.replace(new RegExp(`<%= ${key} %>`, 'g'), value)
  })
  return result
}
