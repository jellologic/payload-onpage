/**
 * Integration tests: a real Payload (SQLite in memory) with the plugin, driven
 * through Payload's own request handling (`handleEndpoints`). Each security
 * property of the endpoints has a test here.
 */
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import {
  createModeCookie,
  HEADER,
  readModeCookie,
  stegaDecode,
  type OnPageMode,
  type SessionAdapter,
} from '@payload-onpage/core'
import {
  buildConfig,
  getPayload,
  handleEndpoints,
  type Payload,
  type SanitizedConfig,
} from 'payload'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { onpage } from '../index.ts'
import { verifyPreviewToken } from '../tokens.ts'

const ORIGIN = 'http://onpage.test'
const SECRET = 'integration-secret'

/** Records what the endpoints asked the framework adapter to do. */
const calls: Array<{ fn: string; args: unknown }> = []
const session: SessionAdapter = {
  async enable(mode: OnPageMode, { sealMode, ...opts }) {
    // What the adapter would store, read back with the plugin's secret: proves it is sealed with it.
    const cookie = await createModeCookie(mode, {
      sealMode,
      expiresAt: new Date(Date.now() + 60_000),
    })
    const verified = (await readModeCookie(cookie, () => undefined, SECRET))?.mode
    calls.push({ fn: 'enable', args: { mode, ...opts, verified } })
  },
  async enableLink(opts) {
    calls.push({ fn: 'enableLink', args: { ...opts, sealed: await opts.seal('NEXT_SECRET') } })
  },
  async disable() {
    calls.push({ fn: 'disable', args: null })
  },
  async getMode() {
    return null
  },
}

let config: SanitizedConfig
let payload: Payload
// Filled in beforeAll.
const ids = {} as Record<'admin' | 'editor' | 'adminPage' | 'editorPage', string | number>
const tokens: Record<string, string> = {}

const isAdmin = (user: any) => user?.collection === 'users' && user.role === 'admin'

beforeAll(async () => {
  config = await buildConfig({
    secret: SECRET,
    serverURL: ORIGIN,
    db: sqliteAdapter({ client: { url: ':memory:' } }),
    telemetry: false,
    logger: { options: { level: 'silent' } },
    admin: { user: 'users' },
    collections: [
      {
        slug: 'users',
        auth: true,
        fields: [
          {
            name: 'role',
            type: 'select',
            options: ['admin', 'editor', 'viewer'],
            defaultValue: 'editor',
          },
        ],
      },
      { slug: 'customers', auth: true, fields: [] },
      {
        slug: 'pages',
        versions: { drafts: { autosave: { interval: 1500 } } },
        admin: { useAsTitle: 'title' },
        access: {
          read: () => true,
          // Row-level rule: admins edit anything, editors only their own pages.
          update: ({ req }) =>
            isAdmin(req.user)
              ? true
              : req.user?.collection === 'users' &&
                  (req.user as { role?: string }).role === 'editor'
                ? { author: { equals: req.user.id } }
                : false,
          create: ({ req }) => !!req.user,
        },
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'slug', type: 'text', required: true },
          { name: 'body', type: 'textarea' },
          { name: 'author', type: 'relationship', relationTo: 'users' },
          { name: 'price', type: 'number', access: { update: ({ req }) => isAdmin(req.user) } },
        ],
      },
      {
        slug: 'fragile',
        access: {
          read: () => true,
          update: () => {
            throw new Error('broken rule')
          },
        },
        fields: [{ name: 'title', type: 'text' }],
      },
      {
        slug: 'locked',
        access: { read: () => true, update: () => false },
        fields: [{ name: 'title', type: 'text' }],
      },
    ],
    globals: [
      {
        slug: 'header',
        access: {
          read: () => true,
          update: ({ req }) =>
            req.user?.collection === 'users' && (req.user as { role?: string }).role !== 'viewer',
        },
        fields: [{ name: 'tagline', type: 'text' }],
      },
    ],
    plugins: [
      onpage({ collections: ['pages', 'fragile', 'locked'], globals: ['header'], session }),
    ],
  })
  payload = await getPayload({ config })
  const admin = await payload.create({
    collection: 'users',
    data: { email: 'admin@test.dev', password: 'correct-horse-battery', role: 'admin' },
  })
  const editor = await payload.create({
    collection: 'users',
    data: { email: 'editor@test.dev', password: 'correct-horse-battery', role: 'editor' },
  })
  await payload.create({
    collection: 'users',
    data: { email: 'viewer@test.dev', password: 'correct-horse-battery', role: 'viewer' },
  })
  await payload.create({
    collection: 'customers',
    data: { email: 'customer@test.dev', password: 'correct-horse-battery' },
  })
  ids.admin = admin.id
  ids.editor = editor.id
  ids.adminPage = (
    await payload.create({
      collection: 'pages',
      data: { title: 'Admin page', slug: 'admin-page', author: admin.id, _status: 'published' },
    })
  ).id
  ids.editorPage = (
    await payload.create({
      collection: 'pages',
      data: { title: 'Editor page', slug: 'editor-page', author: editor.id, _status: 'published' },
    })
  ).id
  for (const [name, collection, email] of [
    ['admin', 'users', 'admin@test.dev'],
    ['editor', 'users', 'editor@test.dev'],
    ['viewer', 'users', 'viewer@test.dev'],
    ['customer', 'customers', 'customer@test.dev'],
  ] as const) {
    const res = await payload.login({
      collection,
      data: { email, password: 'correct-horse-battery' },
    })
    tokens[name] = res.token!
  }
}, 60_000)

beforeEach(() => {
  calls.length = 0
})

type As = 'admin' | 'editor' | 'viewer' | 'customer' | null
function call(
  method: string,
  path: string,
  opts: { as?: As; origin?: string | null; body?: unknown; headers?: Record<string, string> } = {},
) {
  const headers: Record<string, string> = { ...opts.headers }
  if (opts.as) headers.authorization = `JWT ${tokens[opts.as]}`
  if (opts.origin !== null && method !== 'GET') headers.origin = opts.origin ?? ORIGIN
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  return handleEndpoints({
    config,
    request: new Request(`${ORIGIN}/api${path}`, {
      method,
      headers,
      ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
    }),
  })
}
const enterPath = (id: string | number, extra = '') =>
  `/onpage/enter?kind=collection&slug=pages&id=${id}${extra}`

describe('schema endpoint', () => {
  it('requires an editor of the admin user collection', async () => {
    expect((await call('GET', '/onpage/schema/collection/pages')).status).toBe(403)
    expect((await call('GET', '/onpage/schema/collection/pages', { as: 'customer' })).status).toBe(
      403,
    )
    expect((await call('GET', '/onpage/schema/collection/media', { as: 'admin' })).status).toBe(404)
  })
  it('leaves out system fields and fields the user may not update; lists relation targets', async () => {
    const editor = await (
      await call('GET', '/onpage/schema/collection/pages', { as: 'editor' })
    ).json()
    expect(editor.editable).toEqual(['title', 'slug', 'body', 'author'])
    expect(editor.drafts).toBe(true)
    expect(editor.autosaveInterval).toBe(1500)
    expect(editor.relations).toEqual({ users: { titleField: 'id', label: 'User' } })
    const admin = await (
      await call('GET', '/onpage/schema/collection/pages', { as: 'admin' })
    ).json()
    expect(admin.editable).toContain('price')
    expect((await call('GET', '/onpage/schema/global/header', { as: 'admin' })).status).toBe(200)
  })
  it('denies the schema when update access is definitively false or throws', async () => {
    // Row-level editors still get the schema (their rule needs a document to evaluate).
    expect((await call('GET', '/onpage/schema/collection/pages', { as: 'editor' })).status).toBe(
      200,
    )
    // Definitive denial: boolean false, and a rule that throws (fail closed, not unfiltered).
    expect((await call('GET', '/onpage/schema/collection/pages', { as: 'viewer' })).status).toBe(
      403,
    )
    expect((await call('GET', '/onpage/schema/collection/locked', { as: 'admin' })).status).toBe(
      403,
    )
    expect((await call('GET', '/onpage/schema/collection/fragile', { as: 'admin' })).status).toBe(
      403,
    )
  })
})

describe('enter / mode / exit', () => {
  it('only accepts same-origin POSTs (CSRF)', async () => {
    expect((await call('GET', enterPath(ids.adminPage), { as: 'admin' })).status).toBe(404) // no GET route
    expect(
      (await call('POST', enterPath(ids.adminPage), { as: 'admin', origin: 'https://evil.test' }))
        .status,
    ).toBe(403)
    expect(
      (await call('POST', enterPath(ids.adminPage), { as: 'admin', origin: null })).status,
    ).toBe(403)
  })
  it("enforces row-level access: an editor can't open someone else's page", async () => {
    expect((await call('POST', enterPath(ids.adminPage), { as: 'editor' })).status).toBe(403)
    const own = await call('POST', enterPath(ids.editorPage), { as: 'editor' })
    expect(own.status).toBe(303)
    expect(own.headers.get('location')).toBe(`${ORIGIN}/editor-page`)
    expect(calls).toEqual([
      {
        fn: 'enable',
        args: { mode: 'edit', secure: false, bindTo: 'payload-token', verified: 'edit' },
      },
    ])
  })
  it('refuses users of other auth collections', async () => {
    expect((await call('POST', enterPath(ids.editorPage), { as: 'customer' })).status).toBe(403)
    // Signed in but not allowed → 403; not signed in at all → 401.
    expect((await call('POST', '/onpage/mode?mode=edit&path=/', { as: 'customer' })).status).toBe(
      403,
    )
    expect((await call('POST', '/onpage/mode?mode=edit&path=/')).status).toBe(401)
    expect(calls).toEqual([])
  })
  it('refuses mode to users who can edit nothing, keeps it for row-level editors', async () => {
    expect((await call('POST', '/onpage/mode?mode=edit&path=/', { as: 'viewer' })).status).toBe(403)
    expect(calls).toEqual([])
    const editor = await call('POST', '/onpage/mode?mode=edit&path=/', { as: 'editor' })
    expect(editor.status).toBe(303)
    expect(calls).toEqual([
      {
        fn: 'enable',
        args: { mode: 'edit', secure: false, bindTo: 'payload-token', verified: 'edit' },
      },
    ])
  })
  it('answers anonymous callers uniformly, whatever the slug', async () => {
    const bad = '/onpage/enter?kind=collection&slug=nope&id=1'
    expect((await call('POST', bad)).status).toBe(401)
    expect((await call('POST', bad, { as: 'customer' })).status).toBe(403)
    expect((await call('POST', bad, { as: 'admin' })).status).toBe(400)
    const body = { kind: 'collection', slug: 'nope', id: 1 }
    expect((await call('POST', '/onpage/preview-link', { body })).status).toBe(403)
    expect((await call('POST', '/onpage/preview-link', { as: 'customer', body })).status).toBe(403)
    expect((await call('POST', '/onpage/preview-link', { as: 'admin', body })).status).toBe(400)
  })
  it('never redirects off-site', async () => {
    for (const bad of ['//evil.test', '/%09/evil.test', '/\t/evil.test', 'https://evil.test']) {
      const res = await call('POST', `/onpage/exit?path=${encodeURIComponent(bad)}`)
      expect(new URL(res.headers.get('location')!).origin).toBe(ORIGIN)
      const enter = await call(
        'POST',
        enterPath(ids.adminPage, `&path=${encodeURIComponent(bad)}`),
        { as: 'admin' },
      )
      expect(new URL(enter.headers.get('location')!).origin).toBe(ORIGIN)
    }
  })
})

describe('preview links', () => {
  it('needs JSON, edit rights, and derives the path on the server', async () => {
    expect(
      (
        await call('POST', '/onpage/preview-link', {
          as: 'admin',
          headers: { 'content-type': 'text/plain' },
        })
      ).status,
    ).toBe(415)
    expect(
      (
        await call('POST', '/onpage/preview-link', {
          as: 'editor',
          body: { kind: 'collection', slug: 'pages', id: ids.adminPage },
        })
      ).status,
    ).toBe(403)
    const res = await call('POST', '/onpage/preview-link', {
      as: 'admin',
      body: { kind: 'collection', slug: 'pages', id: ids.adminPage, path: '/somewhere-else' },
    })
    expect(res.status).toBe(200)
    const { url, expiresAt } = await res.json()
    const token = new URL(url).searchParams.get('token')!
    const payloadOf = await verifyPreviewToken(token, SECRET)
    expect(payloadOf).toMatchObject({ path: '/admin-page', ref: `c:pages:${ids.adminPage}` })
    expect(new Date(expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(24 * 3600 * 1000)
  })
  it('opens: hands the adapter a sealed grant for that page only', async () => {
    const link = await (
      await call('POST', '/onpage/preview-link', {
        as: 'admin',
        body: { kind: 'collection', slug: 'pages', id: ids.adminPage },
      })
    ).json()
    const res = await handleEndpoints({ config, request: new Request(link.url) })
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(`${ORIGIN}/admin-page`)
    const args = calls[0]!.args as { path: string; sealed: string }
    expect(calls[0]!.fn).toBe('enableLink')
    expect(args.path).toBe('/admin-page')
    expect(args.sealed).not.toContain('NEXT_SECRET')
  })
  it('rejects tampered tokens, and links whose document moved', async () => {
    expect((await call('GET', '/onpage/preview?token=nope')).status).toBe(403)
    const link = await (
      await call('POST', '/onpage/preview-link', {
        as: 'admin',
        body: { kind: 'collection', slug: 'pages', id: ids.editorPage },
      })
    ).json()
    await payload.update({
      collection: 'pages',
      id: ids.editorPage,
      data: { slug: 'moved' },
      draft: true,
    })
    expect((await handleEndpoints({ config, request: new Request(link.url) })).status).toBe(403)
    await payload.update({
      collection: 'pages',
      id: ids.editorPage,
      data: { slug: 'editor-page' },
      draft: true,
    })
    expect(calls.find((c) => c.fn === 'enableLink')).toBeUndefined()
  })
})

describe('writes', () => {
  const save = (id: string | number, data: object, seen?: string) =>
    call('PATCH', `/pages/${id}?draft=true&autosave=true&depth=0`, {
      as: 'admin',
      body: data,
      headers: seen ? { [HEADER.ifUnmodifiedSince]: seen } : {},
    })

  it('rejects a stale write with 409, accepts consecutive editor saves', async () => {
    const current = await payload.findByID({ collection: 'pages', id: ids.adminPage, draft: true })
    const first = await save(ids.adminPage, { body: 'one' }, current.updatedAt)
    expect(first.status).toBe(200)
    const afterFirst = (await first.json()).doc.updatedAt as string
    const second = await save(ids.adminPage, { body: 'two' }, afterFirst)
    expect(second.status).toBe(200)
    // Someone else saves in between…
    await payload.update({
      collection: 'pages',
      id: ids.adminPage,
      data: { body: 'theirs' },
      draft: true,
    })
    const stale = await save(ids.adminPage, { body: 'mine' }, (await second.json()).doc.updatedAt)
    expect(stale.status).toBe(409)
    // …and writes without the header (admin, API) are untouched.
    expect((await save(ids.adminPage, { body: 'api' })).status).toBe(200)
  })

  it('drops __proto__ keys from writes without breaking the save', async () => {
    const res = await save(ids.adminPage, JSON.parse('{"body":"kept","__proto__":{"x":1}}'))
    expect(res.status).toBe(200)
    const stored = await payload.findByID({ collection: 'pages', id: ids.adminPage, draft: true })
    expect(stored.body).toBe('kept')
    expect(Object.getPrototypeOf(stored)).toBe(Object.prototype)
  })

  it('never stores markers, and only marks reads that ask for them', async () => {
    const marked = await payload.findByID({
      collection: 'pages',
      id: ids.adminPage,
      draft: true,
      context: { onpage: true },
    })
    expect(stegaDecode(marked.title)[0]).toMatchObject({ path: 'title' })
    expect(stegaDecode(String(marked.slug))).toEqual([]) // machine value
    const plain = await payload.findByID({ collection: 'pages', id: ids.adminPage, draft: true })
    expect(stegaDecode(plain.title)).toEqual([])
    await payload.update({
      collection: 'pages',
      id: ids.adminPage,
      data: { title: marked.title },
      draft: true,
    })
    const stored = await payload.findByID({ collection: 'pages', id: ids.adminPage, draft: true })
    expect(stored.title).toBe('Admin page')
  })
})
