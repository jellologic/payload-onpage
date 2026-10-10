import { defineConfig, devices } from '@playwright/test'

const PORT = 3101
const DB_DIR = '/tmp/payload-onpage-e2e'

/** End-to-end tests against examples/basic with a fresh SQLite database. Run `bun run build` first. */
export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    // Locally use the installed Chrome; CI installs Playwright's Chromium.
    ...(process.env.CI ? {} : { channel: 'chrome' }),
  },
  webServer: {
    command: `rm -rf ${DB_DIR} && mkdir -p ${DB_DIR} && cd ../examples/basic && bunx next dev --port ${PORT}`,
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
