/**
 * Documentation media: screenshots (docs/media/*.png) and screen recordings
 * (turned into docs/media/*.gif by scripts/docs-media.mjs). Each scene drives
 * examples/basic on a freshly seeded database, so the media always shows the
 * same content and stays reproducible. Run with `bun run docs:media`.
 */
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const MEDIA = join(import.meta.dirname, '..', 'docs', 'media')
const VIDEO_DIR = '/tmp/payload-onpage-media-video'
const VIEWPORT = { width: 1280, height: 800 }
mkdirSync(MEDIA, { recursive: true })

test.describe.configure({ mode: 'serial' })

/** Enter edit mode on a page through the plugin's endpoint (what "Edit on page" does). */
async function enterEditing(context: BrowserContext, page: Page, id = 1, path = '/') {
  await page.goto('/admin') // the example signs in automatically
  await page.waitForURL(/\/admin/)
  const res = await context.request.post(
    `/api/onpage/enter?kind=collection&slug=pages&id=${id}&mode=edit`,
    { headers: { origin: new URL(page.url()).origin }, maxRedirects: 0 },
  )
  expect(res.status()).toBe(303)
  await page.goto(path)
  await expect(page.getByTestId('onpage-status')).toHaveText(/Editing draft|Draft saved/)
}

/** Next's dev-mode indicator isn't part of the product. */
const HIDE_DEV_UI = 'nextjs-portal{display:none!important}'

const shot = async (
  page: Page,
  name: string,
  clip?: { x: number; y: number; width: number; height: number },
) => {
  await page.addStyleTag({ content: HIDE_DEV_UI })
  await page.screenshot({ path: join(MEDIA, `${name}.png`), ...(clip ? { clip } : {}) })
}

/** A visible cursor for recordings (Playwright's videos don't show the mouse). Ignored by the editor. */
const CURSOR = () => {
  addEventListener('DOMContentLoaded', () => {
    const hide = document.createElement('style')
    hide.textContent = 'nextjs-portal{display:none!important}'
    document.head.appendChild(hide)
    const c = document.createElement('div')
    c.setAttribute('data-onpage-ui', '')
    Object.assign(c.style, {
      position: 'fixed',
      left: '-40px',
      top: '-40px',
      width: '18px',
      height: '18px',
      borderRadius: '50%',
      background: 'rgba(17,24,39,.8)',
      border: '2px solid #fff',
      boxShadow: '0 1px 6px rgba(0,0,0,.35)',
      transform: 'translate(-50%,-50%)',
      transition: 'width .12s, height .12s',
      zIndex: '2147483647',
      pointerEvents: 'none',
    })
    document.body.appendChild(c)
    addEventListener(
      'mousemove',
      (e) => Object.assign(c.style, { left: `${e.clientX}px`, top: `${e.clientY}px` }),
      true,
    )
    addEventListener(
      'mousedown',
      () => Object.assign(c.style, { width: '28px', height: '28px' }),
      true,
    )
    addEventListener(
      'mouseup',
      () => Object.assign(c.style, { width: '18px', height: '18px' }),
      true,
    )
  })
}

/** A signed-in session (the example signs in on /admin), so recordings start on the page itself. */
async function signedIn(browser: Browser) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/admin')
  await page.waitForURL(/\/admin/)
  await page.getByTestId('onpage-edit-on-page').or(page.locator('nav')).first().waitFor()
  const state = await context.storageState()
  await context.close()
  return state
}

/**
 * A recording that starts on the page in edit mode: signed in and entered
 * before the page opens, with a visible cursor, saved under `name`.
 */
async function recording(browser: Browser, name: string) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    storageState: await signedIn(browser),
    recordVideo: { dir: join(VIDEO_DIR, name), size: VIEWPORT },
    permissions: ['clipboard-read', 'clipboard-write'],
  })
  await context.addInitScript(CURSOR)
  const base = test.info().project.use.baseURL ?? ''
  const res = await context.request.post(
    `${base}/api/onpage/enter?kind=collection&slug=pages&id=1&mode=edit`,
    {
      headers: { origin: base },
      maxRedirects: 0,
    },
  )
  expect(res.status()).toBe(303)
  const page = await context.newPage()
  await page.goto('/')
  await expect(page.getByTestId('onpage-status')).toHaveText(/Editing draft|Draft saved/)
  return { context, page }
}

/** Move the mouse to an element smoothly (so a recording shows where it went), optionally at an offset. */
async function glide(page: Page, target: Locator, at?: { x: number; y: number }) {
  await target.scrollIntoViewIfNeeded()
  const box = await target.boundingBox()
  if (!box) throw new Error('target not visible')
  await page.mouse.move(box.x + (at?.x ?? box.width / 2), box.y + (at?.y ?? box.height / 2), {
    steps: 30,
  })
  await page.waitForTimeout(350)
}

const pause = (page: Page, ms = 900) => page.waitForTimeout(ms)

// ── Screenshots ─────────────────────────────────────────────────────────────

test('admin: Edit on page and Copy preview link', async ({ page }) => {
  await page.goto('/admin/collections/pages/1')
  await page.getByTestId('onpage-edit-on-page').waitFor()
  await pause(page, 1500)
  await shot(page, 'admin-controls', { x: 0, y: 0, width: VIEWPORT.width, height: 280 })
})

test('editing: hover outline, field label and the dock', async ({ context, page }) => {
  await enterEditing(context, page)
  const h1 = page.locator('h1').first()
  await h1.hover({ position: { x: 40, y: 20 } })
  await pause(page, 600)
  await shot(page, 'editing-hover')
})

test('inline text editing', async ({ context, page }) => {
  await enterEditing(context, page)
  await page
    .locator('h1')
    .first()
    .click({ position: { x: 4, y: 10 } })
  await expect(page.getByTestId('onpage-inline-text')).toBeFocused()
  await page.keyboard.type('Now ')
  await pause(page, 400)
  await shot(page, 'inline-edit')
  await page.keyboard.press('Escape')
})

test('sections: toolbar, settings and the block picker', async ({ context, page }) => {
  await enterEditing(context, page)
  await page
    .locator('section')
    .first()
    .click({ position: { x: 5, y: 5 } })
  await expect(page.getByTestId('onpage-block-toolbar')).toBeVisible()
  await pause(page, 500)
  await shot(page, 'section-toolbar')
  await page.getByTestId('onpage-block-settings').click()
  await expect(page.getByTestId('onpage-settings')).toBeVisible()
  await pause(page, 500)
  await shot(page, 'settings-panel')
  await page.keyboard.press('Escape')
  await page.getByTestId('onpage-insert-below').click()
  await expect(page.getByTestId('onpage-block-picker')).toBeVisible()
  await pause(page, 500)
  await shot(page, 'block-picker')
  await page.keyboard.press('Escape')
})

test('value editors: select and rich text', async ({ context, page }) => {
  await enterEditing(context, page)
  const icon = page.locator('.features li .icon').first()
  await icon.scrollIntoViewIfNeeded()
  await icon.click()
  await expect(page.getByTestId('onpage-select')).toBeVisible()
  await pause(page, 400)
  await shot(page, 'select-editor')
  await page.keyboard.press('Escape')

  const p = page.locator('.content p').first()
  await p.scrollIntoViewIfNeeded()
  const box = await p.boundingBox()
  if (!box) throw new Error('no paragraph')
  await page.mouse.click(box.x + 1, box.y + box.height / 2)
  await expect(page.getByRole('toolbar', { name: 'Text formatting' })).toBeVisible()
  await pause(page, 500)
  await shot(page, 'rich-text')
  await page.getByTestId('onpage-rt-done').click()
})

test('share link: a read-only draft view', async ({ context, page, browser }) => {
  await enterEditing(context, page)
  const link = await page.evaluate(async () => {
    const res = await fetch('/api/onpage/preview-link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'collection', slug: 'pages', id: 1 }),
    })
    return ((await res.json()) as { url: string }).url
  })
  const anon = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 })
  const viewer = await anon.newPage()
  await viewer.goto(link)
  await expect(viewer.getByTestId('onpage-preview-toolbar')).toContainText('Shared preview')
  await pause(viewer, 600)
  await shot(viewer, 'shared-preview')
  await anon.close()
})

// ── Recordings (→ GIFs) ─────────────────────────────────────────────────────

test('recording: edit text in place', async ({ browser }) => {
  const { context, page } = await recording(browser, 'edit-text')
  await pause(page, 600)
  const h1 = page.locator('h1').first()
  await glide(page, h1, { x: 60, y: 24 })
  await pause(page, 700)
  await page.mouse.down()
  await page.mouse.up()
  await expect(page.getByTestId('onpage-inline-text')).toBeFocused()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('Edit your site right on the page', { delay: 70 })
  await pause(page, 400)
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('onpage-status')).toHaveText(/Draft saved/, { timeout: 20_000 })
  await glide(page, page.getByTestId('onpage-status'))
  await pause(page, 1600)
  await context.close()
})

test('recording: rearrange and add sections', async ({ browser }) => {
  const { context, page } = await recording(browser, 'sections')
  const hero = page.locator('section').first()
  await glide(page, hero, { x: 5, y: 5 })
  await page.mouse.down()
  await page.mouse.up()
  await expect(page.getByTestId('onpage-block-toolbar')).toBeVisible()
  await pause(page)
  await glide(page, page.getByTestId('onpage-block-down'))
  await page.getByTestId('onpage-block-down').click()
  await pause(page, 1200)
  await glide(page, page.getByTestId('onpage-block-up'))
  await page.getByTestId('onpage-block-up').click()
  await pause(page, 1000)
  await glide(page, page.getByTestId('onpage-insert-below'))
  await page.getByTestId('onpage-insert-below').click()
  const picker = page.getByTestId('onpage-block-picker')
  await expect(picker).toBeVisible()
  await pause(page)
  const choice = picker.locator('button[data-testid^="onpage-block-"]').first()
  await glide(page, choice)
  await choice.click()
  await pause(page, 2200)
  await context.close()
})

test('recording: preview the draft on any device', async ({ browser }) => {
  const { context, page } = await recording(browser, 'preview')
  await pause(page, 600)
  await glide(page, page.getByTestId('onpage-preview'))
  await page.getByTestId('onpage-preview').click()
  await expect(page.getByTestId('onpage-preview-toolbar')).toBeVisible()
  await pause(page)
  await glide(page, page.getByTestId('onpage-device-phone'))
  await page.getByTestId('onpage-device-phone').click()
  await pause(page, 1600)
  await glide(page, page.getByTestId('onpage-device-tablet'))
  await page.getByTestId('onpage-device-tablet').click()
  await pause(page, 1600)
  await glide(page, page.getByTestId('onpage-device-desktop'))
  await page.getByTestId('onpage-device-desktop').click()
  await pause(page, 900)
  await glide(page, page.getByTestId('onpage-edit'))
  await page.getByTestId('onpage-edit').click()
  await expect(page.getByTestId('onpage-dock')).toBeVisible()
  await pause(page, 1400)
  await context.close()
})
