import { createHash } from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

/** Which example this run targets (mirrors playwright.config.ts): `basic` (Next.js) or `tanstack`. */
const isTanstack = process.env.ONPAGE_EXAMPLE === 'tanstack'

const clean = (s: string | null) => (s ?? '').replace(/[\u200b-\u200d\u2060-\u2064]/g, '')

/** Sign in (the example auto-logs in on /admin) and open a page in edit mode via the admin button. */
async function editPage(
  context: BrowserContext,
  collectionPath = '/admin/collections/pages/1',
): Promise<Page> {
  const admin = await context.newPage()
  await admin.goto(collectionPath)
  const button = admin.getByTestId('onpage-edit-on-page').first()
  await button.waitFor()
  // The admin hydrates after first paint; a pre-hydration click is a silent
  // no-op, so retry until the edit tab opens.
  let page: Page | null = null
  for (let attempt = 0; attempt < 10 && !page; attempt++) {
    const [opened] = await Promise.all([
      context
        .waitForEvent('page', { timeout: 3000 })
        .then((p) => p)
        .catch(() => null),
      button.click().then(
        () => true,
        () => false,
      ),
    ])
    page = opened
  }
  if (!page) throw new Error('edit tab did not open')
  await page.waitForLoadState('load')
  await admin.close()
  await expect(page.getByTestId('onpage-status')).toHaveText(/Editing draft|Draft saved/)
  return page
}

async function api<T>(page: Page, path: string): Promise<T> {
  return page.evaluate(async (p) => (await fetch(p)).json(), path) as Promise<T>
}

test.describe.configure({ mode: 'serial' })

test('visitors get clean HTML: no markers, no editor attributes', async ({ request }) => {
  const html = await (await request.get('/')).text()
  expect(html).not.toMatch(/[⁢⁣⁤]/)
  expect(html).not.toContain('data-onpage')
})

test('edit text in place; the draft is saved without markers', async ({ context }) => {
  const page = await editPage(context)
  const heading = page.locator('h1').first()
  await heading.click({ position: { x: 4, y: 10 } })
  const inline = page.getByTestId('onpage-inline-text')
  await expect(inline).toBeFocused()
  await page.keyboard.type('E2E ')
  await page.keyboard.press('Enter')
  await expect(heading).toContainText('E2E ')
  const draft = await api<{ layout: Array<{ heading?: string }> }>(
    page,
    '/api/pages/1?draft=true&depth=0',
  )
  expect(draft.layout[0]!.heading).toMatch(/^E2E /)
  expect(JSON.stringify(draft)).not.toMatch(/[⁢⁣⁤]/)
})

test('a global and the page edit together', async ({ context }) => {
  const page = await editPage(context)
  await expect(page.getByTestId('onpage-doc-count')).toHaveText('2 documents')
  const brand = page.locator('.site-header .brand')
  const box = (await brand.boundingBox())!
  await page.mouse.click(box.x + box.width - 2, box.y + box.height / 2)
  await page.keyboard.press('End')
  await page.keyboard.type(' Ltd')
  await page.keyboard.press('Enter')
  await expect(brand).toContainText('Ltd')
  expect(
    (await api<{ siteName: string }>(page, '/api/globals/header?draft=true')).siteName,
  ).toMatch(/Ltd$/)
})

test('value editors: select, date, relationship, color', async ({ context }) => {
  const page = await editPage(context)
  await page.locator('.features li .icon').first().click()
  await page.getByTestId('onpage-option-heart').click()
  await expect(page.locator('.features li .icon').first()).toHaveText('♥')

  await page.locator('[data-onpage-field="publishedAt"]').click()
  await page.getByTestId('onpage-date-input').fill('2027-03-14')
  await page.getByTestId('onpage-apply').click()
  await expect(page.locator('[data-onpage-field="publishedAt"]')).toHaveText('March 14, 2027')

  await page.locator('[data-onpage-field="author"]').click()
  await expect(page.getByRole('option', { name: 'Dev Editor' })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.locator('[data-onpage-field="accent"]').click()
  await page.getByTestId('onpage-color-input').fill('#0ea5e9')
  await page.getByTestId('onpage-apply').click()
  await expect
    .poll(() => page.locator('main').evaluate((el) => el.style.getPropertyValue('--accent')))
    .toBe('#0ea5e9')
})

test('schema hides fields the user may not update', async ({ browser }) => {
  const schemaAs = async (email: string | null) => {
    // A fresh context per user (no shared cookie jar). Header auth resolves
    // the user deterministically; the anonymous case disables dev autoLogin,
    // which would otherwise authenticate the request as the seeded admin.
    const ctx = await browser.newContext()
    try {
      const headers: Record<string, string> = { DisableAutologin: 'true' }
      if (email) {
        const login = await ctx.request.post('/api/users/login', {
          data: { email, password: 'test' },
        })
        expect(login.ok()).toBe(true)
        headers.authorization = `JWT ${((await login.json()) as { token: string }).token}`
      }
      const res = await ctx.request.get('/api/onpage/schema/collection/pages', { headers })
      const editable = res.ok() ? ((await res.json()) as { editable: string[] }).editable : []
      return { status: res.status(), editable }
    } finally {
      await ctx.close()
    }
  }
  const admin = await schemaAs('dev@example.com')
  expect(admin.status).toBe(200)
  expect(admin.editable).toContain('title')
  expect(admin.editable).toContain('internalNote')
  const editor = await schemaAs('editor@example.com')
  expect(editor.status).toBe(200)
  expect(editor.editable).toContain('title')
  expect(editor.editable).not.toContain('internalNote')
  expect((await schemaAs(null)).status).toBe(403)
})

test('rich text', async ({ context }) => {
  const page = await editPage(context)
  const p = page.locator('.content p').first()
  await p.scrollIntoViewIfNeeded()
  const box = (await p.boundingBox())!
  await page.mouse.click(box.x + 1, box.y + box.height / 2)
  await expect(page.getByRole('toolbar', { name: 'Text formatting' })).toBeVisible()
  // The editor places the caret at the click point once its surface is in place (then focuses it).
  await expect(page.locator('.po-rt-surface')).toBeFocused()
  await page.keyboard.type('Rich ')
  await page.getByTestId('onpage-rt-done').click()
  await expect(p).toContainText('Rich ')
})

test('rich text: link a word to another page of the site', async ({ context }) => {
  const page = await editPage(context)
  const p = page.locator('.content p').first()
  await p.scrollIntoViewIfNeeded()
  await p.dblclick({ position: { x: 20, y: 8 } }) // opens the editor and selects a word
  await expect(page.locator('.po-rt-surface')).toBeFocused()
  await page
    .locator('.po-rt-surface p')
    .first()
    .dblclick({ position: { x: 20, y: 8 } })
  await page.getByTestId('onpage-rt-link').click()
  await page.getByTestId('onpage-rt-link-mode-page').click()
  await page.getByTestId('onpage-rt-link-search').fill('About')
  await page.locator('[data-testid^="onpage-rt-link-hit-"]').first().click()
  await page.getByTestId('onpage-rt-done').click()
  // Saved as Payload stores internal links: linkType internal and a doc reference.
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const res = await fetch('/api/pages/1?draft=true&depth=0')
        return JSON.stringify(await res.json()).includes('"linkType":"internal"')
      }),
    )
    .toBe(true)
})

test('keyboard: Enter edits, ⌥↓ moves a row, ⌘Z undoes', async ({ context }) => {
  const page = await editPage(context)
  const titles = page.locator('.features li h3')
  const first = clean(await titles.first().textContent())
  await page.locator('.features li').first().focus()
  await page.keyboard.press('Alt+ArrowDown')
  await expect.poll(async () => clean(await titles.nth(1).textContent())).toBe(first)
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(async () => clean(await titles.first().textContent())).toBe(first)
  await page.locator('h1').first().focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('onpage-inline-text')).toBeVisible()
  await page.keyboard.press('Escape')
})

test('drag a feature card to another place, then undo', async ({ context }) => {
  const page = await editPage(context)
  const titles = page.locator('.features li h3')
  const names = async () => (await titles.allTextContents()).map(clean)
  const before = await names()
  // The list at the top of the window (window heights differ between machines).
  await page.locator('.features').evaluate((el) => el.scrollIntoView({ block: 'start' }))
  // Select the first card; its toolbar has the drag handle.
  await page
    .locator('.features li')
    .first()
    .click({ position: { x: 4, y: 4 } })
  const handle = page.getByTestId('onpage-item-drag')
  await expect(handle).toBeVisible()
  const from = (await handle.boundingBox())!
  const last = (await page.locator('.features li').last().boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  const height = page.viewportSize()!.height
  await page.mouse.move(last.x + last.width - 4, Math.min(last.y + last.height / 2, height - 80), {
    steps: 8,
  })
  await expect(page.getByTestId('onpage-drop-line')).toBeVisible()
  await page.mouse.up()
  await expect.poll(names).toEqual([...before.slice(1), before[0]])
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(names).toEqual(before)
})

test.describe('in a short window', () => {
  test.use({ viewport: { width: 1280, height: 420 } })
  test('dragging a section to the bottom edge scrolls the page; the drag goes on', async ({
    context,
  }) => {
    const page = await editPage(context)
    const order = () => page.locator('section').evaluateAll((s) => s.map((x) => x.className))
    const before = await order()
    await page
      .locator('section')
      .first()
      .click({ position: { x: 5, y: 5 } })
    const from = (await page.getByTestId('onpage-block-drag').boundingBox())!
    const top = await page.evaluate(() => window.scrollY)
    await page.mouse.move(from.x + 8, from.y + 8)
    await page.mouse.down()
    for (let i = 0; i < 60; i++) await page.mouse.move(from.x + 8, 410 - (i % 2))
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(top + 100)
    await expect(page.getByTestId('onpage-drop-line')).toBeVisible()
    await page.mouse.up()
    await expect.poll(order).not.toEqual(before)
    await page.keyboard.press('ControlOrMeta+z')
    await expect.poll(order).toEqual(before)
  })
})

test('client mode updates live while typing', async ({ context }) => {
  const page = await editPage(context, '/admin/collections/pages/2')
  const h1 = page.locator('h1').first()
  await h1.click()
  const inline = page.getByTestId('onpage-inline-text')
  await expect(inline).toBeFocused()
  // Put the caret at the very end, whatever the platform's End key does.
  await inline.evaluate((el) => {
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    getSelection()?.removeAllRanges()
    getSelection()?.addRange(range)
  })
  await page.keyboard.type('!')
  await expect(h1).toContainText('!') // rendered from editor state before any save
  await page.keyboard.press('Enter')
})

test('block picker: thumbnails; client mode previews in place until one is chosen', async ({
  context,
}) => {
  const page = await editPage(context, '/admin/collections/pages/2')
  const sections = page.locator('main section')
  const before = await sections.count()
  const openPicker = async () => {
    await sections.last().hover()
    await page.getByTestId('onpage-insert-below').click()
    await expect(page.getByTestId('onpage-block-picker')).toBeVisible()
  }

  await openPicker()
  await expect(page.getByTestId('onpage-block-hero').locator('img')).toHaveAttribute(
    'src',
    '/blocks/hero.svg',
  )
  await expect(page.getByRole('heading', { name: 'Headers' })).toBeVisible()
  const axe = await new AxeBuilder({ page })
    .include('[data-testid="onpage-block-picker"]')
    .analyze()
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
    [],
  )

  // Hovering shows the block's example content on the page; Escape takes it away.
  await page.getByTestId('onpage-block-hero').hover()
  await expect(page.getByText('Your big idea, front and center')).toBeVisible()
  await expect(sections).toHaveCount(before + 1)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('onpage-block-picker')).toBeHidden()
  await expect(sections).toHaveCount(before)
  await expect(page.getByText('Your big idea, front and center')).toHaveCount(0)

  // Choosing Hero inserts its defaults: its example is preview-only.
  await openPicker()
  await page.getByTestId('onpage-block-hero').click()
  await expect(page.getByTestId('onpage-block-picker')).toBeHidden()
  await expect(sections).toHaveCount(before + 1)
  await expect(page.getByText('Your big idea, front and center')).toHaveCount(0)
  await expect(page.getByTestId('onpage-status')).toHaveText(/Draft saved/)
  await page.keyboard.press('ControlOrMeta+z')
  await expect(sections).toHaveCount(before)

  // Features sets insertExample: it starts from its example. It saves, and ⌘Z undoes.
  await openPicker()
  await page.getByTestId('onpage-block-features').hover()
  await expect(page.getByTestId('onpage-block-features')).toHaveClass(/is-previewing/)
  await expect(page.getByText('Why people choose us')).toBeVisible()
  await page.getByTestId('onpage-block-features').click()
  await expect(page.getByTestId('onpage-block-picker')).toBeHidden()
  await expect(sections).toHaveCount(before + 1)
  await expect(page.getByText('Why people choose us')).toBeVisible()
  await expect(page.getByTestId('onpage-status')).toHaveText(/Draft saved/)
  await page.keyboard.press('ControlOrMeta+z')
  await expect(sections).toHaveCount(before)
})

test('editor UI has no serious accessibility violations', async ({ context }) => {
  const page = await editPage(context)
  await page
    .locator('section')
    .first()
    .click({ position: { x: 5, y: 5 } })
  const results = await new AxeBuilder({ page }).include('[data-onpage-ui]').analyze()
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  )
  expect(
    serious.map(
      (v) =>
        `${v.id}: ${v.help} :: ${v.nodes.map((n) => `${n.target.join(' ')} ${n.any[0]?.message ?? ''}`).join(' | ')}`,
    ),
  ).toEqual([])
})

test('image editor: alt text for the current image, and before an upload', async ({ context }) => {
  const page = await editPage(context)
  await page.locator('section img').first().click()
  const current = page.getByTestId('onpage-media-alt-current')
  await expect(current).toBeVisible()
  expect(clean(await current.inputValue())).toBe(await current.inputValue()) // no markers
  // A new file waits for its alt text (cancelled here, so nothing is uploaded).
  await page
    .locator('[data-testid="onpage-media-picker"] input[type=file]')
    .setInputFiles({ name: 'IMG_2034.png', mimeType: 'image/png', buffer: Buffer.from('x') })
  await expect(page.getByTestId('onpage-media-alt')).toBeFocused()
  const results = await new AxeBuilder({ page }).include('[data-onpage-ui]').analyze()
  expect(
    results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map(
        (v) =>
          `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} ${n.any[0]?.message ?? ''}`).join(' | ')}`,
      ),
  ).toEqual([])
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByTestId('onpage-media-alt')).toHaveCount(0)
  await expect(current).toBeVisible()
})

test('page settings and the publish menu (choose, schedule)', async ({ context }) => {
  const page = await editPage(context)
  // Page settings: the page's own fields that aren't on it.
  await page.getByTestId('onpage-page-settings-open').click()
  const settings = page.getByTestId('onpage-page-settings')
  await expect(settings).toBeVisible()
  await expect(settings.getByText('Client-mode demo')).toBeVisible() // a top-level checkbox
  await expect(settings.getByText('Slug', { exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(settings).toHaveCount(0)

  // Publish menu: the page is listed; schedule it for tomorrow.
  await page.getByTestId('onpage-publish-more').click()
  const panel = page.getByTestId('onpage-publish-panel')
  await expect(panel).toBeVisible()
  const results = await new AxeBuilder({ page }).include('[data-onpage-ui]').analyze()
  expect(
    results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
  ).toEqual([])
  const tomorrow = new Date(Date.now() + 86_400_000)
  const local = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16)
  await page.getByTestId('onpage-schedule-at').fill(local)
  await page.getByTestId('onpage-schedule').click()
  await expect(page.getByTestId('onpage-status')).toHaveText(/Scheduled to publish/)
  await expect(panel).toHaveCount(0)
})

test('share links: draft on the shared page only, no draft credential in the browser', async ({
  context,
  browser,
}) => {
  const page = await editPage(context)
  await page.getByTestId('onpage-share').click()
  await expect(page.getByTestId('onpage-status')).toHaveText(/Preview link copied/)
  const link = await page.evaluate(async () => {
    const res = await fetch('/api/onpage/preview-link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'collection', slug: 'pages', id: 1 }),
    })
    return ((await res.json()) as { url: string }).url
  })
  const anon = await browser.newContext()
  const viewer = await anon.newPage()
  await viewer.goto(link)
  await expect(viewer.getByTestId('onpage-preview-toolbar')).toContainText('Shared preview')
  await expect(viewer.locator('h1').first()).toContainText('E2E ') // the draft
  const shared = viewer.url()
  const cookies = await anon.cookies()
  // TanStack Start also sets a non-credential hint so the mount can skip its
  // state fetch for visitors; it grants nothing by itself.
  expect(cookies.map((c) => c.name).sort()).toEqual(
    isTanstack ? ['onpage_hint', 'onpage_preview'] : ['onpage_preview'],
  )

  // Another page stays published, even with a forged draft cookie.
  await anon.addCookies(
    isTanstack
      ? [
          { name: 'onpage', value: 'forged', url: viewer.url() },
          { name: 'onpage_preview', value: 'forged', url: viewer.url() },
        ]
      : [{ name: '__prerender_bypass', value: 'forged', url: viewer.url() }],
  )
  await viewer.goto('/about')
  await expect(viewer.getByTestId('onpage-preview-toolbar')).toHaveCount(0)

  // Tampered and missing tokens are refused.
  expect((await viewer.goto(`${link.slice(0, -3)}AAA`))!.status()).toBe(403)

  // A hand-made mode cookie, or a session binding the client made up (its
  // cookie name and value both chosen), shows no drafts and no editor.
  const forger = await browser.newContext()
  const forged = await forger.newPage()
  const binding = `edit:x:${createHash('sha256').update('y').digest('hex').slice(0, 32)}`
  for (const value of ['view', 'edit', binding]) {
    await forger.addCookies([
      { name: 'x', value: 'y', url: shared },
      { name: 'onpage', value, url: shared },
    ])
    await forged.goto(shared)
    await expect(forged.locator('h1').first()).not.toContainText('E2E ')
    await expect(forged.getByTestId('onpage-dock')).toHaveCount(0)
  }
  await forger.close()

  // Leaving clears the grant.
  await viewer.goto(link)
  await viewer.getByTestId('onpage-exit-preview').click()
  await expect(viewer.getByTestId('onpage-preview-toolbar')).toHaveCount(0)
  expect((await anon.cookies()).filter((c) => c.name.startsWith('onpage'))).toEqual([])
  await anon.close()
})

test('preview mode for editors, then exit', async ({ context }) => {
  const page = await editPage(context)
  await page.getByTestId('onpage-preview').click()
  await expect(page.getByTestId('onpage-preview-toolbar')).toContainText('Previewing the draft')
  const axe = await new AxeBuilder({ page }).include('[data-onpage-ui]').analyze()
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
    [],
  )
  await page.getByTestId('onpage-edit').click()
  await expect(page.getByTestId('onpage-dock')).toBeVisible()
  await page.getByTestId('onpage-exit').click()
  await expect(page.getByTestId('onpage-dock')).toHaveCount(0)
})
