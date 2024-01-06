import { t } from 'chainsi'

export const locale = {
  prompts: {
    requestVuejsCorePath: {
      // prettier-ignore
      $t: () =>
        `${t('💁').blue.bold._} input your local vuejs/core ${t('absolute').green.bold.underline._} path:\n` +
        `  ${t('e.g. /Users/ubugeeei/oss/vuejs-core\n').grey._}` +
        `  > `,
    },
    confirmUseRootPath: {
      $t: () =>
        // prettier-ignore
        `${t('Are you sure to use root path?').red._} ${t('(Y/n)').grey._}\n` +
        `  > `,
    },
  },
  success: {
    generate: {
      $t: (targetPath: string) =>
        // prettier-ignore
        `\n==================================================================\n\n` +
        `${t('🎉 vuejs/core hmr project was created successfully!').green._}\n` +
        `  (${t('>>>').blue._} ${t(targetPath).green._})\n\n` +
        `${t('You can start by').grey._} ${t('nr dev:vue').cyan.bold.underline._}\n`+
        `\n==================================================================\n\n` +
        `${t('Enjoy your learning! 😎').green._}`,
    },
  },
  warnings: {
    rootPath: {
      $t: () =>
        // prettier-ignore
        `${t('⚠️ You are using root path.').yellow._}\n`,
    },
  },
  errors: {
    targetDirHasAlreadyExist: {
      $t: () => `${t('[Error] Target directory has already exist!').red._}\n`,
    },
    noEmptyPathInput: {
      $t: () => `${t('[Invalid input] empty input is not allowed.').red._}\n`,
    },
    noRelativePathInput: {
      $t: () =>
        // prettier-ignore
        `${t('[Invalid input] input must be an').red._} ${t('absolute').yellow.bold.underline._} ${t('path').red._}\n`,
    },
  },
}
