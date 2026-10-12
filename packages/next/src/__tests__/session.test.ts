import { COOKIE, createModeCookie, modeSealer, sha256 } from '@payload-onpage/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// A minimal stand-in for next/headers: request cookies in, response cookies out.
const state = vi.hoisted(() => ({
  draft: false,
  cookies: new Map<string, string>(),
  set: [] as Array<{ name: string; value: string; opts?: Record<string, unknown> | undefined }>,
  headers: new Map<string, string>(),
}))
vi.mock('next/headers.js', () => ({
  draftMode: async () => ({
    get isEnabled() {
      return state.draft
    },
    enable() {
      state.draft = true
      state.cookies.set('__prerender_bypass', 'NEXT_SECRET')
    },
    disable() {
      state.draft = false
    },
  }),
  cookies: async () => ({
    get: (name: string) =>
      state.cookies.has(name) ? { name, value: state.cookies.get(name)! } : undefined,
    set: (name: string, value: string, opts?: Record<string, unknown>) => {
      state.set.push({ name, value, opts })
      state.cookies.set(name, value)
    },
    delete: (name: string) => {
      state.set.push({ name, value: '' })
      state.cookies.delete(name)
    },
  }),
  headers: async () => ({ get: (n: string) => state.headers.get(n) ?? null }),
}))

const { nextSession, getOnPageMode, isDraftEnabled, onpageContext, isSharedPreview } =
  await import('../session.ts')

const SECRET = 'test-secret-not-for-prod'
const sealMode = modeSealer(SECRET)
const later = () => new Date(Date.now() + 3600_000)

beforeEach(() => {
  state.draft = false
  state.cookies.clear()
  state.set = []
  state.headers.clear()
})

describe('nextSession', () => {
  it('binds edit mode to the auth cookie; signing out ends it', async () => {
    state.cookies.set('payload-token', 'JWT-1')
    await nextSession().enable('edit', { secure: true, bindTo: 'payload-token', sealMode })
    const mode = state.set.find((c) => c.name === COOKIE.mode)!
    expect(mode.value).toMatch(
      new RegExp(`^edit:payload-token:${(await sha256('JWT-1')).slice(0, 32)}\\.[\\w-]+$`),
    )
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

  it('preview links: only a sealed grant reaches the browser, never the draft secret', async () => {
    const seal = vi.fn(async (secret: string) => `sealed(${secret})`)
    await nextSession().enableLink({
      secure: true,
      path: '/a',
      expiresAt: new Date(Date.now() + 1000),
      seal,
    })
    expect(seal).toHaveBeenCalledWith('NEXT_SECRET')
    const last = new Map(state.set.map((c) => [c.name, c]))
    expect(last.get(COOKIE.nextDraft)?.value).toBe('') // deleted from the response
    expect(last.get(COOKIE.preview)?.value).toBe('sealed(NEXT_SECRET)')
  })

  it('cdnBypass: the draft cookie stays, scoped to the shared page and the link lifetime', async () => {
    const expiresAt = new Date(Date.now() + 60_000)
    await nextSession({ cdnBypass: true }).enableLink({
      secure: true,
      path: '/a',
      expiresAt,
      seal: async (secret) => `sealed(${secret})`,
    })
    const last = new Map(state.set.map((c) => [c.name, c]))
    expect(last.get(COOKIE.nextDraft)?.value).toBe('NEXT_SECRET')
    expect(last.get(COOKIE.nextDraft)?.opts).toMatchObject({
      path: '/a',
      expires: expiresAt,
      httpOnly: true,
      secure: true,
    })
    expect(last.get(COOKIE.preview)?.value).toBe('sealed(NEXT_SECRET)')
  })

  it('cdnBypass defaults on only when deployed on Vercel', async () => {
    const link = {
      secure: true,
      path: '/a',
      expiresAt: new Date(Date.now() + 1000),
      seal: async () => 's',
    }
    vi.stubEnv('VERCEL', '1')
    await nextSession().enableLink(link)
    expect(new Map(state.set.map((c) => [c.name, c])).get(COOKIE.nextDraft)?.value).toBe(
      'NEXT_SECRET',
    )
    vi.unstubAllEnvs()
    state.set = []
    await nextSession().enableLink(link)
    expect(new Map(state.set.map((c) => [c.name, c])).get(COOKIE.nextDraft)?.value).toBe('')
  })

  it('a preview-link viewer leaving clears the cookie scoped to that page', async () => {
    state.cookies.set(COOKIE.preview, 'sealed')
    state.draft = true
    await nextSession().disable({ path: '/a' })
    const draft = state.set.find((c) => c.name === COOKIE.nextDraft)!
    expect(draft.opts).toMatchObject({ path: '/a', maxAge: 0 })
    expect(state.cookies.has(COOKIE.preview)).toBe(false)
  })

  it('disable clears everything', async () => {
    await nextSession().enable('view', { secure: false, sealMode })
    await nextSession().disable()
    expect(state.draft).toBe(false)
    expect(state.cookies.has(COOKIE.mode)).toBe(false)
    expect(state.cookies.has(COOKIE.preview)).toBe(false)
  })
})

describe('helpers', () => {
  it('are inert without draft mode', async () => {
    state.cookies.set(COOKIE.mode, await createModeCookie('edit', { sealMode, expiresAt: later() }))
    expect(await getOnPageMode()).toBeNull()
    expect(await isDraftEnabled()).toBe(false)
    expect(await onpageContext()).toEqual({})
  })
  it('respect draft mode enabled by something else (no onpage cookie)', async () => {
    state.draft = true
    expect(await isDraftEnabled()).toBe(true)
    expect(await getOnPageMode()).toBeNull()
  })
  it('recognise a proxy-injected preview-link view', async () => {
    state.draft = true
    state.cookies.set(COOKIE.mode, await createModeCookie('view', { sealMode, expiresAt: later() }))
    state.headers.set('x-onpage-shared', '1')
    expect(await getOnPageMode()).toBe('view')
    expect(await isSharedPreview()).toBe(true)
    expect(await onpageContext()).toEqual({})
  })
  it('reject an unknown mode value', async () => {
    state.draft = true
    state.cookies.set(COOKIE.mode, 'admin')
    expect(await getOnPageMode()).toBeNull()
    expect(await isDraftEnabled()).toBe(false)
  })
  it('reject an unsealed mode cookie (hand-made, or from before 0.5.1)', async () => {
    state.draft = true
    for (const forged of ['edit', 'view', `edit:x:${(await sha256('y')).slice(0, 32)}`]) {
      state.cookies.set('x', 'y')
      state.cookies.set(COOKIE.mode, forged)
      expect(await getOnPageMode()).toBeNull()
      expect(await isDraftEnabled()).toBe(false)
    }
  })
})
