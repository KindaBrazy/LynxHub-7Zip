import eslint from '@eslint/js';
import {defineConfig} from 'eslint/config';
import globals from 'globals';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

const MAX_LINE_LENGTH = 120;

export default defineConfig([
  {
    ignores: ['node_modules', 'out', '.gitignore'],
  },

  eslint.configs.recommended,
  eslintPluginPrettierRecommended,

  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },

    settings: {
      react: {
        version: '19',
      },
    },

    rules: {
      'no-async-promise-executor': 'off',

      'max-len': ['error', {code: MAX_LINE_LENGTH, ignoreComments: true}],

      'no-useless-escape': 'off',
      'prettier/prettier': [
        'error',
        {
          proseWrap: 'always',
          singleQuote: true,
          printWidth: MAX_LINE_LENGTH,
          bracketSpacing: false,
          bracketSameLine: true,
          arrowParens: 'avoid',
          endOfLine: 'auto',
        },
      ],
    },
  },
]);
