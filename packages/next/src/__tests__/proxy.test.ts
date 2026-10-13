import {
  COOKIE,
  createModeCookie,
  HEADER,
  modeSealer,
  readModeCookie,
  SEAL_PURPOSE,
  seal,
  sha256,
} from '@payload-onpage/core'
import { NextRequest } from 'next/server.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { withOnPage } from '../proxy.ts'

const secret = 'proxy-secret'
const modeCookie = (mode: 'edit' | 'view', bind?: { name: string; token: string }) =>
  createModeCookie(mode, {
    sealMode: modeSealer(secret),
    expiresAt: new Date(Date.now() + 3600_000),
    bindTo: bind?.name,
    token: bind?.token,
  })
const cookieValue = (h: Headers, name: string) =>
  (h.get('cookie') ?? '')
    .split('; ')
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1)

afterEach(() => vi.unstubAllEnvs())
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
    // A sealed view-mode cookie, which server components can read.
    expect(await readModeCookie(cookieValue(on, COOKIE.mode), () => undefined, secret)).toEqual({
      mode: 'view',
      bound: false,
    })
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
    const editor = `${COOKIE.nextDraft}=abc; ${COOKIE.mode}=${await modeCookie('edit')}`
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

  it("strips a preview viewer's draft cookie on pages the grant does not cover", async () => {
    const cookie = `${COOKIE.nextDraft}=NEXT_DRAFT_SECRET; ${COOKIE.preview}=${await grant()}; theme=dark`
    const elsewhere = await withOnPage(req('/drafts/secret', cookie), { secret })
    expect(elsewhere.get('cookie')).not.toContain(COOKIE.nextDraft)
    expect(elsewhere.get('cookie')).toContain('theme=dark')
    const expired = `${COOKIE.nextDraft}=NEXT_DRAFT_SECRET; ${COOKIE.preview}=${await grant({ exp: 1 })}`
    expect((await withOnPage(req('/', expired), { secret })).get('cookie')).not.toContain(
      COOKIE.nextDraft,
    )
  })

  it('strips a forged or unsealed mode cookie even without a draft cookie', async () => {
    const h = await withOnPage(req('/x', `${COOKIE.mode}=edit; theme=dark`), { secret })
    expect(h.get('cookie')).toBe('theme=dark')
  })

  describe('strict guard (allowDraft)', () => {
    const copied = `${COOKIE.nextDraft}=NEXT_DRAFT_SECRET`
    it('a copied draft cookie with no grant unlocks nothing', async () => {
      const h = await withOnPage(req('/drafts/secret', copied), { secret, allowDraft: () => false })
      expect(h.get('cookie')).not.toContain(COOKIE.nextDraft)
    })
    it('keeps it for an editor whose bound session is still signed in', async () => {
      const bound = await modeCookie('edit', { name: 'auth', token: 'TOKEN' })
      const allowDraft = () => false
      const signedIn = await withOnPage(
        req('/x', `${copied}; ${COOKIE.mode}=${bound}; auth=TOKEN`),
        { secret, allowDraft },
      )
      expect(signedIn.get('cookie')).toContain(COOKIE.nextDraft)
      const signedOut = await withOnPage(req('/x', `${copied}; ${COOKIE.mode}=${bound}`), {
        secret,
        allowDraft,
      })
      expect(signedOut.get('cookie')).not.toContain(COOKIE.nextDraft)
      expect(signedOut.get('cookie')).not.toContain(COOKIE.mode)
    })
    it('asks allowDraft otherwise, and fails closed when it throws', async () => {
      expect(
        (await withOnPage(req('/x', copied), { secret, allowDraft: async () => true })).get(
          'cookie',
        ),
      ).toContain(COOKIE.nextDraft)
      const thrown = await withOnPage(req('/x', copied), {
        secret,
        allowDraft: () => {
          throw new Error('db down')
        },
      })
      expect(thrown.get('cookie')).not.toContain(COOKIE.nextDraft)
    })
    it('a forged binding (cookie name and value both chosen by the client) unlocks nothing', async () => {
      const forged = `edit:x:${(await sha256('y')).slice(0, 32)}`
      for (const value of [forged, `${forged}.tampered`, 'edit', 'view']) {
        const h = await withOnPage(req('/x', `${copied}; x=y; ${COOKIE.mode}=${value}`), {
          secret,
          allowDraft: () => false,
        })
        expect(h.get('cookie')).not.toContain(COOKIE.nextDraft)
        expect(h.get('cookie')).not.toContain(`${COOKIE.mode}=`)
      }
    })
    it('a mode cookie sealed with another secret unlocks nothing', async () => {
      const other = await createModeCookie('edit', {
        sealMode: modeSealer('other-secret'),
        expiresAt: new Date(Date.now() + 3600_000),
        bindTo: 'auth',
        token: 'TOKEN',
      })
      const h = await withOnPage(req('/x', `${copied}; auth=TOKEN; ${COOKIE.mode}=${other}`), {
        secret,
        allowDraft: () => false,
      })
      expect(h.get('cookie')).not.toContain(COOKIE.nextDraft)
    })
    it('is the default on Vercel: a copied draft cookie with no grant unlocks nothing', async () => {
      vi.stubEnv('VERCEL', '1')
      const h = await withOnPage(req('/drafts/secret', copied), { secret })
      expect(h.get('cookie')).not.toContain(COOKIE.nextDraft)
      const editor = await withOnPage(
        req(
          '/x',
          `${copied}; auth=TOKEN; ${COOKIE.mode}=${await modeCookie('edit', { name: 'auth', token: 'TOKEN' })}`,
        ),
        { secret },
      )
      expect(editor.get('cookie')).toContain(COOKIE.nextDraft)
    })
    it('never asks when the grant covers the page', async () => {
      const allowDraft = vi.fn(() => false)
      const h = await withOnPage(req('/', `${copied}; ${COOKIE.preview}=${await grant()}`), {
        secret,
        allowDraft,
      })
      expect(h.get(HEADER.shared)).toBe('1')
      expect(allowDraft).not.toHaveBeenCalled()
    })
  })
})
