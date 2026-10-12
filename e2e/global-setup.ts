import { chromium, type FullConfig } from '@playwright/test'

/**
 * Vite (the TanStack example) finds the admin's dependencies on the first
 * visit and reloads the page while it optimizes them. Visit once before the
 * tests, so none of them meets that reload.
 */
export default async function warmUp(config: FullConfig) {
  if (process.env.ONPAGE_EXAMPLE !== 'tanstack') return
  const baseURL = config.projects[0]?.use.baseURL
  if (!baseURL) return
  const browser = await chromium.launch(process.env.CI ? {} : { channel: 'chrome' })
  const page = await browser.newPage({ baseURL })
  try {
    for (const path of ['/admin/collections/pages/1', '/']) {
      await page.goto(path, { waitUntil: 'networkidle', timeout: 120_000 })
      // A dependency-optimizing reload shows up as another load; let it settle.
      await page.waitForLoadState('networkidle', { timeout: 60_000 })
    }
  } finally {
    await browser.close()
  }
}
