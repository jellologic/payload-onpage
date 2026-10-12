import { defineConfig, devices } from '@playwright/test'

/** Which example to run against: `basic` (Next.js) or `tanstack` (TanStack Start). */
const EXAMPLE = process.env.ONPAGE_EXAMPLE === 'tanstack' ? 'tanstack' : 'basic'
const PORT = EXAMPLE === 'tanstack' ? 3105 : 3101
const DB_DIR = `/tmp/payload-onpage-e2e${EXAMPLE === 'tanstack' ? '-tanstack' : ''}`
const SERVER =
  EXAMPLE === 'tanstack' ? `bunx vite dev --port ${PORT}` : `bunx next dev --port ${PORT}`

/** End-to-end tests against examples/${EXAMPLE} with a fresh SQLite database. Run `bun run build` first. */
export default defineConfig({
  testDir: '.',
  globalSetup: './global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    // The dock's Share copies the link to the clipboard.
    permissions: ['clipboard-read', 'clipboard-write'],
    ...devices['Desktop Chrome'],
    // Locally use the installed Chrome; CI installs Playwright's Chromium.
    ...(process.env.CI ? {} : { channel: 'chrome' }),
  },
  webServer: {
    command: `rm -rf ${DB_DIR} && mkdir -p ${DB_DIR} && cd ../examples/${EXAMPLE} && ${SERVER}`,
    url: `http://localhost:${PORT}/`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: `file:${DB_DIR}/e2e.db`,
      SERVER_URL: `http://localhost:${PORT}`,
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
})
