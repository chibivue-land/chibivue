const { builtinModules } = require('node:module')

/**
 * @type {import('eslint-define-config').ESLintConfig}
 */
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
  },
  plugins: ['import', '@typescript-eslint'],
  rules: {
    'no-debugger': 'error',
    'sort-imports': ['error', { ignoreDeclarationSort: true }],
  },
}
