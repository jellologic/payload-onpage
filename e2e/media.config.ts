import { defineConfig, devices } from '@playwright/test'

const PORT = 3102
const DB_DIR = '/tmp/payload-onpage-media'

/**
 * Documentation media: screenshots and screen recordings of examples/basic on a
 * freshly seeded database (so every capture shows the same content). Run with
 * `bun run docs:media`, which also turns the recordings into GIFs.
 */
export default defineConfig({
  testDir: '.',
  testMatch: 'media.capture.ts',
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    permissions: ['clipboard-read', 'clipboard-write'],
    colorScheme: 'light',
    ...(process.env.CI ? {} : { channel: 'chrome' }),
  },
  webServer: {
    command: `rm -rf ${DB_DIR} && mkdir -p ${DB_DIR} && cd ../examples/basic && bunx next dev --port ${PORT}`,
    url: `http://localhost:${PORT}/`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: `file:${DB_DIR}/media.db`,
      SERVER_URL: `http://localhost:${PORT}`,
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
})
