import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const src = (pkg: string, file = 'index.ts') =>
  fileURLToPath(new URL(`./packages/${pkg}/src/${file}`, import.meta.url))

// Tests run against source, not dist: no build step, and coverage maps to src.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@payload-onpage\/core$/, replacement: src('core') },
      { find: /^@payload-onpage\/core\/payload$/, replacement: src('core', 'payload.ts') },
      { find: /^@payload-onpage\/plugin$/, replacement: src('plugin') },
      { find: /^@payload-onpage\/plugin\/admin$/, replacement: src('plugin', 'admin/index.ts') },
      { find: /^@payload-onpage\/react$/, replacement: src('react') },
      {
        find: /^@payload-onpage\/react\/annotations$/,
        replacement: src('react', 'annotations.ts'),
      },
      { find: /^@payload-onpage\/react\/client$/, replacement: src('react', 'OnPageClient.tsx') },
      { find: /^@payload-onpage\/react\/editor-kit$/, replacement: src('react', 'editor-kit.ts') },
      { find: /^@payload-onpage\/lexical$/, replacement: src('lexical') },
      { find: /^@payload-onpage\/lexical\/editor$/, replacement: src('lexical', 'editor.ts') },
      { find: /^@payload-onpage\/next$/, replacement: src('next', 'index.tsx') },
      { find: /^@payload-onpage\/next\/client$/, replacement: src('next', 'client.tsx') },
      { find: /^@payload-onpage\/next\/(session|proxy)$/, replacement: src('next', '$1.ts') },
    ],
  },
  test: {
    include: ['packages/*/src/**/__tests__/**/*.test.{ts,tsx}'],
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.{ts,tsx}'],
      exclude: [
        '**/__tests__/**',
        '**/index.ts',
        '**/*.d.ts',
        '**/types.ts',
        '**/ports.ts',
        '**/schema.ts',
      ],
      reporter: ['text-summary', 'lcov'],
      // Per-package gates (lines). CI fails below these.
      thresholds: {
        'packages/core/src/**': { lines: 90 },
        'packages/plugin/src/**': { lines: 90 },
        'packages/react/src/**': { lines: 85 },
        'packages/next/src/**': { lines: 80 },
        'packages/lexical/src/**': { lines: 80 },
      },
    },
  },
})
