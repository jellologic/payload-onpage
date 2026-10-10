import { COOKIE, HEADER, SEAL_PURPOSE, seal } from '@payload-onpage/core'
import { NextRequest } from 'next/server.js'
import { describe, expect, it } from 'vitest'
import { withOnPage } from '../proxy.ts'

const secret = 'proxy-secret'
const req = (path: string, cookie = '', extra: Record<string, string> = {}) =>
  new NextRequest(`http://site.test${path}`, { headers: { cookie, ...extra } })
const grant = (over: Record<string, unknown> = {}) =>
  seal(
    {
      path: '/',
      ref: 'c:pages:1',
      exp: Math.floor(Date.now() / 1000) + 60,
      draft: 'NEXT_DRAFT_SECRET',
      ...over,
    },
    secret,
    SEAL_PURPOSE.previewCookie,
  )

describe('withOnPage (proxy)', () => {
  it('passes the request path and drops a client-supplied shared header', async () => {
    const h = await withOnPage(req('/about', '', { [HEADER.shared]: '1' }), { secret })
    expect(h.get(HEADER.path)).toBe('/about')
    expect(h.get(HEADER.shared)).toBeNull()
  })
  it('injects draft mode on the shared page only', async () => {
    const cookie = `${COOKIE.preview}=${await grant()}; theme=dark`
    const on = await withOnPage(req('/', cookie), { secret })
    expect(on.get('cookie')).toContain(`${COOKIE.nextDraft}=NEXT_DRAFT_SECRET`)
    expect(on.get('cookie')).toContain(`${COOKIE.mode}=view`)
    expect(on.get('cookie')).toContain('theme=dark')
    expect(on.get(HEADER.shared)).toBe('1')
    const off = await withOnPage(req('/products/x', cookie), { secret })
    expect(off.get('cookie')).not.toContain(COOKIE.nextDraft)
    expect(off.get(HEADER.shared)).toBeNull()
  })
  it('ignores expired, foreign-secret, wrong-purpose or tampered grants', async () => {
    const cases = [
      await grant({ exp: Math.floor(Date.now() / 1000) - 1 }),
      await seal({ path: '/', exp: 9e9, draft: 'x' }, 'other-secret', SEAL_PURPOSE.previewCookie),
      await seal({ path: '/', exp: 9e9, draft: 'x' }, secret, SEAL_PURPOSE.previewLink),
      'tampered',
    ]
    for (const value of cases) {
      const h = await withOnPage(req('/', `${COOKIE.preview}=${value}`), { secret })
      expect(h.get('cookie')).not.toContain(`${COOKIE.nextDraft}=`)
    }
  })
  it('does nothing without a secret, and never touches editors', async () => {
    const editor = `${COOKIE.nextDraft}=abc; ${COOKIE.mode}=edit`
    expect((await withOnPage(req('/x', editor), { secret })).get('cookie')).toBe(editor)
    expect(
      (await withOnPage(req('/', `${COOKIE.preview}=${await grant()}`), { secret: undefined })).get(
        'cookie',
      ),
    ).not.toContain(COOKIE.nextDraft)
  })
  it('replaces a client-supplied draft cookie with the granted one on the shared page', async () => {
    const h = await withOnPage(
      req('/', `${COOKIE.nextDraft}=forged; ${COOKIE.preview}=${await grant()}`),
      { secret },
    )
    expect(h.get('cookie')).not.toContain('forged')
  })
})
