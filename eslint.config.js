// @ts-check
import js from '@eslint/js'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/** Package boundaries: modules each package must not import (anchored, so "payload" ≠ "core/payload"). */
const boundary = (names) => ({
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          regex: `^(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&').replace('\\*', '.*')).join('|')})(/.*)?$`,
          message: 'Crosses a package boundary (see CONTRIBUTING.md).',
        },
      ],
    },
  ],
})

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.next/**',
      'examples/**',
      'coverage/**',
      '*.config.*',
      'vitest.setup.ts',
      '.size-limit.cjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { project: ['./tsconfig.test.json'], tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
    },
  },
  {
    files: ['packages/core/src/**'],
    rules: boundary([
      'react',
      'react-dom',
      'next',
      'next/*',
      'payload',
      '@payloadcms/*',
      '@payload-onpage/*',
    ]),
  },
  {
    files: ['packages/react/src/**'],
    rules: boundary([
      'next',
      'next/*',
      'payload',
      '@payloadcms/*',
      '@payload-onpage/next*',
      '@payload-onpage/plugin*',
      '@payload-onpage/lexical*',
    ]),
  },
  {
    files: ['packages/lexical/src/**'],
    rules: boundary([
      'next',
      'next/*',
      'payload',
      '@payloadcms/*',
      '@payload-onpage/next*',
      '@payload-onpage/plugin*',
    ]),
  },
  {
    files: ['packages/plugin/src/**'],
    ignores: ['packages/plugin/src/admin/**'],
    rules: boundary([
      'react',
      'react-dom',
      'next',
      'next/*',
      '@payloadcms/ui',
      '@payload-onpage/react*',
      '@payload-onpage/next*',
      '@payload-onpage/lexical*',
    ]),
  },
  {
    files: ['packages/next/src/**'],
    rules: boundary(['payload', '@payloadcms/*', '@payload-onpage/plugin*']),
  },
  {
    files: ['**/__tests__/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      // Test doubles implement async ports without awaiting anything.
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
)
