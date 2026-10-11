import { describe, expect, it, vi } from 'vitest'
import { HEADER } from '../constants.ts'
import { errorMessage, payloadRest, payloadUploads } from '../payload.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function fetchSpy(responder: (url: string, init?: RequestInit) => Response) {
  const calls: Array<{ url: string; init?: RequestInit | undefined }> = []
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    return responder(url, init)
  }) as unknown as typeof fetch
  return { f, calls }
}

describe('payloadRest', () => {
  it('saves drafts with PATCH (collections) / POST (globals) and the stale-write header', async () => {
    const { f, calls } = fetchSpy(() => json({ doc: { updatedAt: 'v2' } }))
    const ds = payloadRest({ fetch: f, apiBase: '/cms' })
    expect(
      await ds.saveDraft(
        { kind: 'collection', slug: 'pages', id: 1 },
        { title: 'x' },
        { locale: 'es', updatedAt: 'v1' },
      ),
    ).toEqual({ ok: true, updatedAt: 'v2' })
    expect(calls[0]!.url).toBe('/cms/pages/1?locale=es&depth=0&draft=true&autosave=true')
    expect(calls[0]!.init?.method).toBe('PATCH')
    expect(new Headers(calls[0]!.init?.headers).get(HEADER.ifUnmodifiedSince)).toBe('v1')
    expect(JSON.parse(calls[0]!.init?.body as string)).toEqual({ title: 'x' }) // no updatedAt in the body
    await ds.publish({ kind: 'global', slug: 'header' }, { tagline: 't' }, {})
    expect(calls[1]!.url).toBe('/cms/globals/header?depth=0')
    expect(calls[1]!.init?.method).toBe('POST')
    expect(JSON.parse(calls[1]!.init?.body as string)).toEqual({
      tagline: 't',
      _status: 'published',
    })
  })
  it("reports failures with Payload's message and status", async () => {
    const { f } = fetchSpy(() =>
      json(
        { errors: [{ message: 'Invalid', data: { errors: [{ message: 'Title is required' }] } }] },
        400,
      ),
    )
    expect(
      await payloadRest({ fetch: f }).saveDraft({ kind: 'collection', slug: 'p', id: 1 }, {}, {}),
    ).toEqual({ ok: false, status: 400, message: 'Invalid: Title is required' })
    expect(
      await errorMessage(new Response('not json', { status: 500, statusText: 'Server Error' })),
    ).toBe('Server Error')
  })
  it('loads schemas and documents, searches by title field, creates preview links', async () => {
    const { f, calls } = fetchSpy((url) =>
      url.includes('/schema/')
        ? json({ slug: 'pages' })
        : url.includes('preview-link')
          ? json({ url: 'u', expiresAt: 'e' })
          : url.includes('/users?')
            ? json({ docs: [{ id: 2, name: 'Ada' }, { id: 3 }] })
            : json({ id: 1 }),
    )
    const ds = payloadRest({ fetch: f })
    await ds.loadSchema({ kind: 'global', slug: 'header' }, { locale: 'en' })
    expect(calls[0]!.url).toBe('/api/onpage/schema/global/header?locale=en')
    await ds.loadDocument({ kind: 'collection', slug: 'pages', id: 1 }, { draft: true })
    expect(calls[1]!.url).toBe('/api/pages/1?draft=true&depth=2')
    expect(await ds.search!('users', { query: 'Ad', titleField: 'name' })).toEqual([
      { id: 2, title: 'Ada', doc: { id: 2, name: 'Ada' } },
      { id: 3, title: '3', doc: { id: 3 } },
    ])
    expect(decodeURIComponent(calls[2]!.url)).toContain('where[name][like]=Ad')
    expect(
      await ds.createPreviewLink({ kind: 'collection', slug: 'pages', id: 1 }, { locale: 'en' }),
    ).toEqual({ url: 'u', expiresAt: 'e' })
    await expect(
      payloadRest({ fetch: fetchSpy(() => json({ error: 'Forbidden' }, 403)).f }).loadSchema(
        { kind: 'global', slug: 'x' },
        {},
      ),
    ).rejects.toThrow(/Forbidden/)
  })
})

describe('payloadUploads', () => {
  it('searches images with thumbnails and uploads with _payload', async () => {
    const { f, calls } = fetchSpy((_url, init) =>
      init?.method === 'POST'
        ? json({ doc: { id: 9, url: '/new.png', alt: 'new' } })
        : json({
            docs: [
              {
                id: 1,
                url: '/a.png',
                sizes: { thumbnail: { url: '/a-t.png' } },
                alt: 'A',
                filename: 'a.png',
              },
            ],
            hasNextPage: true,
          }),
    )
    const media = payloadUploads({ fetch: f, pageSize: 10 })
    const res = await media.search({ query: 'a', page: 2, relationTo: 'media' })
    expect(res).toMatchObject({
      hasMore: true,
      items: [{ id: 1, thumbnailUrl: '/a-t.png', alt: 'A' }],
    })
    expect(decodeURIComponent(calls[0]!.url)).toContain('where[and][1][or][0][filename][like]=a')
    const item = await media.upload(new File(['x'], 'my-photo_1.png'), { relationTo: 'media' })
    expect(item.id).toBe(9)
    const form = calls[1]!.init?.body as FormData
    expect(JSON.parse(form.get('_payload') as string)).toEqual({ alt: 'my photo 1' })
  })
})

describe('adapter request init', () => {
  it("sends the caller's init (custom auth) on media requests too, with any header form", async () => {
    const { f, calls } = fetchSpy(() => json({ docs: [], doc: { id: 1 } }))
    const init = {
      headers: new Headers({ authorization: 'Bearer t' }),
      credentials: 'omit' as const,
    }
    const media = payloadUploads({ fetch: f, init })
    await media.search({ query: '', relationTo: 'media' })
    await media.upload(new File(['x'], 'a.png'), { relationTo: 'media' })
    for (const c of calls) {
      expect(new Headers(c.init?.headers).get('authorization')).toBe('Bearer t')
      expect(c.init?.credentials).toBe('omit')
    }
    const rest = payloadRest({ fetch: f, init: { headers: [['x-k', 'v']] } })
    await rest.loadDocument({ kind: 'global', slug: 'header' }, { draft: true }).catch(() => {})
    expect(new Headers(calls.at(-1)?.init?.headers).get('x-k')).toBe('v')
  })
  it('picks thumbnails by width, whatever the sizes are named, and prefers thumbnailURL', async () => {
    const docs = [
      {
        id: 1,
        url: '/a.png',
        sizes: {
          huge: { url: '/a-2000.png', width: 2000 },
          tiny: { url: '/a-80.png', width: 80 },
          mid: { url: '/a-400.png', width: 400 },
        },
      },
      {
        id: 2,
        url: '/b.png',
        thumbnailURL: '/b-admin.png',
        sizes: { mid: { url: '/b-400.png', width: 400 } },
      },
      { id: 3, url: '/c.png' },
    ]
    const { f } = fetchSpy(() => json({ docs }))
    const { items } = await payloadUploads({ fetch: f }).search({ query: '', relationTo: 'media' })
    expect(items.map((i) => i.thumbnailUrl)).toEqual(['/a-400.png', '/b-admin.png', '/c.png'])
  })
})
