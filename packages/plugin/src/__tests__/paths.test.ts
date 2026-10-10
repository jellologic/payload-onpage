import { describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { resolvePath } from '../paths.ts'
import { rejectCrossSite, readRef } from '../http.ts'

function req(
  opts: {
    preview?: (doc: Record<string, unknown>) => string | null
    doc?: Record<string, unknown> | null
    serverURL?: string
  } = {},
) {
  return {
    url: 'https://site.test/api/onpage/x',
    method: 'POST',
    headers: new Headers(),
    payload: {
      config: { serverURL: opts.serverURL ?? 'https://site.test' },
      collections: { pages: { config: { admin: { preview: opts.preview } } } },
      findByID: vi.fn(async () => (opts.doc === undefined ? { id: 1, slug: 'about' } : opts.doc)),
      findGlobal: vi.fn(async () => ({ tagline: 'x' })),
    },
  } as unknown as PayloadRequest
}
const page = { kind: 'collection', slug: 'pages', id: 1 } as const

describe('resolvePath', () => {
  it('uses the url option, then admin.preview, then /<slug>; globals default to /', async () => {
    expect(
      await resolvePath(req(), page, {
        kind: 'collection',
        slug: 'pages',
        options: { url: () => '/custom?x=1' },
      }),
    ).toBe('/custom?x=1')
    expect(
      await resolvePath(req({ preview: () => 'https://site.test/en/about' }), page, {
        kind: 'collection',
        slug: 'pages',
        options: {},
      }),
    ).toBe('/en/about')
    expect(await resolvePath(req(), page, { kind: 'collection', slug: 'pages', options: {} })).toBe(
      '/about',
    )
    expect(
      await resolvePath(
        req(),
        { kind: 'global', slug: 'header' },
        { kind: 'global', slug: 'header', options: {} },
      ),
    ).toBe('/')
  })
  it('refuses other origins, missing documents and unsafe paths', async () => {
    expect(
      await resolvePath(req({ preview: () => 'https://evil.test/x' }), page, {
        kind: 'collection',
        slug: 'pages',
        options: {},
      }),
    ).toBeNull()
    expect(
      await resolvePath(req({ doc: null }), page, {
        kind: 'collection',
        slug: 'pages',
        options: {},
      }),
    ).toBeNull()
    expect(
      await resolvePath(req(), page, {
        kind: 'collection',
        slug: 'pages',
        options: { url: () => null },
      }),
    ).toBeNull()
  })
})

describe('http helpers', () => {
  it('readRef parses collection and global refs', () => {
    expect(readRef({ kind: 'global', slug: 'header' })).toEqual({ kind: 'global', slug: 'header' })
    expect(readRef({ slug: 'pages', id: '12' })).toEqual({
      kind: 'collection',
      slug: 'pages',
      id: 12,
    })
    expect(readRef({ slug: 'pages', id: 'abc' })).toEqual({
      kind: 'collection',
      slug: 'pages',
      id: 'abc',
    })
    expect(readRef({ slug: 'pages' })).toBeNull()
    expect(readRef({})).toBeNull()
  })
  it('rejectCrossSite accepts same-origin POSTs only', () => {
    const r = req()
    expect(rejectCrossSite({ ...r, method: 'GET' })?.status).toBe(405)
    expect(
      rejectCrossSite({
        ...r,
        headers: new Headers({ origin: 'https://site.test' }),
      }),
    ).toBeNull()
    expect(
      rejectCrossSite({
        ...r,
        headers: new Headers({ origin: 'https://evil.test' }),
      })?.status,
    ).toBe(403)
    expect(
      rejectCrossSite({
        ...r,
        headers: new Headers({ 'sec-fetch-site': 'same-origin' }),
      }),
    ).toBeNull()
    expect(
      rejectCrossSite({
        ...r,
        headers: new Headers({ 'sec-fetch-site': 'cross-site' }),
      })?.status,
    ).toBe(403)
  })
})
