import js from '@eslint/js'
import { fixupConfigRules } from '@eslint/compat'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

const config = [
  {
    ignores: ['node_modules/**', '.next/**', '.open-next/**', '.vercel/**', 'out/**', 'build/**', 'next-env.d.ts'],
  },
  {
    ...js.configs.recommended,
    files: ['**/*.{js,jsx,mjs,cjs}'],
  },
  ...fixupConfigRules(nextVitals),
  ...fixupConfigRules(nextTypeScript),
  {
    files: ['*.js', 'config/**/*.js'],
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    rules: {
      // Graph thumbnails and raw file URLs are short-lived redirects that cannot use Next's image optimizer.
      '@next/next/no-img-element': 'off',
      'react/no-unescaped-entities': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]

export default config
