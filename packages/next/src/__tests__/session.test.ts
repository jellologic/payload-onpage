import { COOKIE, sha256 } from '@payload-onpage/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// A minimal stand-in for next/headers: request cookies in, response cookies out.
const state = vi.hoisted(() => ({
  draft: false,
  cookies: new Map<string, string>(),
  set: [] as Array<{ name: string; value: string; opts?: Record<string, unknown> }>,
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

beforeEach(() => {
  state.draft = false
  state.cookies.clear()
  state.set = []
  state.headers.clear()
})

describe('nextSession', () => {
  it('binds edit mode to the auth cookie; signing out ends it', async () => {
    state.cookies.set('payload-token', 'JWT-1')
    await nextSession().enable('edit', { secure: true, bindTo: 'payload-token' })
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

  it('disable clears everything', async () => {
    await nextSession().enable('view', { secure: false })
    await nextSession().disable()
    expect(state.draft).toBe(false)
    expect(state.cookies.has(COOKIE.mode)).toBe(false)
    expect(state.cookies.has(COOKIE.preview)).toBe(false)
  })
})

describe('helpers', () => {
  it('are inert without draft mode', async () => {
    state.cookies.set(COOKIE.mode, 'edit')
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
    state.cookies.set(COOKIE.mode, 'view')
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
})
