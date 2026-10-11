import { COOKIE, SEAL_PURPOSE, seal, sha256 } from '@payload-onpage/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// A minimal stand-in for @tanstack/react-start/server: request cookies in,
// response cookies out, plus the request URL for path-bound grants.
const state = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  set: [] as Array<{ name: string; value: string; opts?: Record<string, unknown> | undefined }>,
  deleted: [] as string[],
  path: '/a',
}))
vi.mock('@tanstack/react-start/server', () => ({
  getCookie: (name: string) => state.cookies.get(name),
  setCookie: (name: string, value: string, opts?: Record<string, unknown>) => {
    state.set.push({ name, value, opts })
    state.cookies.set(name, value)
  },
  deleteCookie: (name: string) => {
    state.deleted.push(name)
    state.cookies.delete(name)
  },
  getRequestUrl: () => new URL(`http://test${state.path}`),
}))

const {
  tanstackSession,
  getOnPageMode,
  isDraftEnabled,
  isSharedPreview,
  isSharedPreviewFor,
  onpageContext,
} = await import('../session.server.ts')
import { HINT_COOKIE } from '../hint.ts'

const SECRET = 'test-secret-not-for-prod'

beforeEach(() => {
  state.cookies.clear()
  state.set = []
  state.deleted = []
  state.path = '/a'
  tanstackSession({ secret: SECRET })
})

describe('tanstackSession', () => {
  it('binds edit mode to the auth cookie; signing out ends it', async () => {
    state.cookies.set('payload-token', 'JWT-1')
    await tanstackSession().enable('edit', { secure: true, bindTo: 'payload-token' })
    const mode = state.set.find((c) => c.name === COOKIE.mode)!
    expect(mode.value).toBe(`edit:payload-token:${(await sha256('JWT-1')).slice(0, 32)}`)
    expect(mode.opts).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 43200,
    })
    expect(await getOnPageMode()).toBe('edit')
    expect(await onpageContext()).toEqual({ context: { onpage: true } })

    state.cookies.set('payload-token', 'JWT-2') // signed in as someone else
    expect(await getOnPageMode()).toBeNull()
    expect(await isDraftEnabled()).toBe(false)
    state.cookies.delete('payload-token') // signed out
    expect(await getOnPageMode()).toBeNull()
  })

  it('sets a non-credential hint next to the mode cookie, and clears it on disable', async () => {
    await tanstackSession().enable('view', { secure: false })
    const hint = state.set.find((c) => c.name === HINT_COOKIE)!
    expect(hint.opts).toMatchObject({ httpOnly: false, path: '/' })

    await tanstackSession().disable()
    expect(state.cookies.has(COOKIE.mode)).toBe(false)
    expect(state.cookies.has(COOKIE.preview)).toBe(false)
    expect(state.cookies.has(HINT_COOKIE)).toBe(false)
    expect(state.deleted).toEqual(
      expect.arrayContaining([COOKIE.mode, COOKIE.preview, HINT_COOKIE]),
    )
  })

  it('preview links: only a sealed grant reaches the browser', async () => {
    const sealFn = vi.fn(async (secret: string) => `sealed(${secret})`)
    await tanstackSession().enableLink({
      secure: true,
      path: '/a',
      expiresAt: new Date(Date.now() + 1000),
      seal: sealFn,
    })
    expect(sealFn).toHaveBeenCalledWith('tanstack-start')
    const last = new Map(state.set.map((c) => [c.name, c]))
    expect(state.deleted).toContain(COOKIE.mode)
    expect(last.get(COOKIE.preview)?.value).toBe('sealed(tanstack-start)')
    expect(last.get(COOKIE.preview)?.opts).toMatchObject({ httpOnly: true })
    expect(last.get(HINT_COOKIE)?.value).toBe('1')
  })

  it('reads fail closed when cookies throw (outside a request)', async () => {
    const get = state.cookies.get
    state.cookies.get = () => {
      throw new Error('no request')
    }
    try {
      expect(await getOnPageMode()).toBeNull()
      expect(await isSharedPreview()).toBe(false)
      expect(await isSharedPreviewFor('/a')).toBe(false)
      expect(await isDraftEnabled()).toBe(false)
      expect(await onpageContext()).toEqual({})
    } finally {
      state.cookies.get = get
    }
  })

  it('a hint cookie alone grants nothing', async () => {
    state.cookies.set(HINT_COOKIE, '1')
    expect(await getOnPageMode()).toBeNull()
    expect(await isSharedPreview()).toBe(false)
    expect(await isDraftEnabled()).toBe(false)
    expect(await onpageContext()).toEqual({})
  })
})

describe('shared preview grants', () => {
  const grant = (over: Record<string, unknown> = {}) =>
    seal(
      {
        path: '/a',
        ref: 'c:pages:1',
        exp: Math.floor(Date.now() / 1000) + 3600,
        draft: 'x',
        ...over,
      },
      SECRET,
      SEAL_PURPOSE.previewCookie,
    )

  it('a live grant for this path enables drafts (view-only, no markers)', async () => {
    state.cookies.set(COOKIE.preview, await grant())
    expect(await isSharedPreview()).toBe(true)
    expect(await isDraftEnabled()).toBe(true)
    expect(await getOnPageMode()).toBeNull()
    expect(await onpageContext()).toEqual({})
  })

  it('checks an explicit path for browser-invoked server functions (RPC URL, not the page)', async () => {
    state.cookies.set(COOKIE.preview, await grant({ path: '/shared' }))
    state.path = '/_serverFn/x/getOnPageState'
    expect(await isSharedPreview()).toBe(false)
    expect(await isSharedPreviewFor('/shared')).toBe(true)
    expect(await isSharedPreviewFor('/elsewhere')).toBe(false)
  })

  it('refuses grants for other paths, expired, tampered, or wrong-secret grants', async () => {
    state.cookies.set(COOKIE.preview, await grant({ path: '/b' }))
    expect(await isSharedPreview()).toBe(false)

    state.path = '/b'
    expect(await isSharedPreview()).toBe(true) // the grant works where it was issued
    state.path = '/a'

    state.cookies.set(COOKIE.preview, await grant({ exp: Math.floor(Date.now() / 1000) - 1 }))
    expect(await isSharedPreview()).toBe(false)

    const good = await grant()
    state.cookies.set(COOKIE.preview, `${good.slice(0, -2)}xx`)
    expect(await isSharedPreview()).toBe(false)

    state.cookies.set(
      COOKIE.preview,
      await seal(
        { path: '/a', ref: 'c:pages:1', exp: Math.floor(Date.now() / 1000) + 3600, draft: 'x' },
        'another-secret',
        SEAL_PURPOSE.previewCookie,
      ),
    )
    expect(await isSharedPreview()).toBe(false)
    expect(await isDraftEnabled()).toBe(false)
  })

  it('grants never validate without a configured secret', async () => {
    vi.resetModules()
    const fresh = await import('../session.server.ts')
    state.cookies.set(COOKIE.preview, await grant())
    // Fresh module: tanstackSession({ secret }) was never called here.
    expect(await fresh.isSharedPreview()).toBe(false)
    expect(await fresh.isDraftEnabled()).toBe(false)
  })
})
