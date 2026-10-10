import { describe, expect, it } from 'vitest'
import { stegaClean, stegaCleanDeep, stegaDecode } from '@payload-onpage/core'
import { serializeFields } from '../schema.ts'
import { payloadFields } from '../../../core/src/__tests__/fixtures/payloadFields.ts'
import { encodeDocument } from '@payload-onpage/core'
import { createPreviewToken, verifyPreviewToken } from '../tokens.ts'
import { onpage, wantsMarkers } from '../index.ts'

const fields = serializeFields([
  { name: 'title', type: 'text' },
  { name: 'slug', type: 'text' },
  { name: 'summary', type: 'textarea' },
  { name: 'status', type: 'select', options: ['a', 'b'] },
  { name: 'views', type: 'number' },
  { name: 'body', type: 'richText' },
  { name: 'hero', type: 'upload', relationTo: 'media' },
  {
    name: 'layout',
    type: 'blocks',
    blocks: [
      {
        slug: 'cta',
        fields: [
          { name: 'heading', type: 'text' },
          {
            name: 'buttons',
            type: 'array',
            fields: [
              { name: 'label', type: 'text' },
              { name: 'url', type: 'text' },
            ],
          },
        ],
      },
    ],
  },
] as any)

const doc = {
  id: 5,
  title: 'Home',
  slug: 'home',
  summary: 'Line one\nLine two',
  status: 'a',
  views: 3,
  body: {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', text: 'Hello ' },
            { type: 'link', fields: { url: '/x' }, children: [{ type: 'text', text: 'world' }] },
          ],
        },
      ],
    },
  },
  hero: { id: 9, url: '/hero.jpg', alt: 'Warehouse' },
  layout: [
    {
      id: 'b1',
      blockType: 'cta',
      heading: 'Talk to us',
      buttons: [{ id: 'x', label: 'Contact', url: '/contact' }],
    },
  ],
}

describe('encodeDocument (auto-mapping)', () => {
  const out: any = encodeDocument(doc, fields, 'c:pages:5')

  it('marks displayable strings with their exact field paths', () => {
    expect(stegaDecode(out.title)).toEqual([{ ref: 'c:pages:5', path: 'title', kind: 'text' }])
    expect(stegaDecode(out.summary)[0]).toMatchObject({ path: 'summary', kind: 'textarea' })
    expect(stegaDecode(out.layout[0].heading)[0].path).toBe('layout.0.heading')
    expect(stegaDecode(out.layout[0].buttons[0].label)[0].path).toBe('layout.0.buttons.0.label')
  })

  it('marks rich-text text nodes (including inside links) with the field path', () => {
    const p = out.body.root.children[0]
    expect(stegaDecode(p.children[0].text)[0]).toMatchObject({ path: 'body', kind: 'richtext' })
    expect(stegaDecode(p.children[1].children[0].text)[0].path).toBe('body')
    expect(p.children[1].fields.url).toBe('/x')
  })

  it("maps images through the upload's alt text", () => {
    expect(stegaDecode(out.hero.alt)[0]).toMatchObject({ path: 'hero', kind: 'media' })
    expect(stegaClean(out.hero.alt)).toBe('Warehouse')
    expect(out.hero.url).toBe('/hero.jpg')
  })

  it('never marks machine values', () => {
    expect(out.slug).toBe('home')
    expect(out.status).toBe('a')
    expect(out.views).toBe(3)
    expect(out.layout[0].buttons[0].url).toBe('/contact')
    expect(out.id).toBe(5)
  })

  it('does not mutate the input, and cleans back to the original exactly', () => {
    expect(doc.title).toBe('Home')
    expect(stegaCleanDeep(out)).toEqual(doc)
  })

  it('respects an encode filter and `only`', () => {
    const filtered: any = encodeDocument(doc, fields, 'c:pages:5', {
      filter: ({ path }) => path !== 'title',
    })
    expect(filtered.title).toBe('Home')
    const only: any = encodeDocument(doc, fields, 'c:pages:5', { only: ['summary'] })
    expect(only.title).toBe('Home')
    expect(stegaDecode(only.summary)).toHaveLength(1)
  })
})

describe('serializeFields', () => {
  const schema = serializeFields(payloadFields as any)
  it('flattens rows/unnamed tabs, drops ui fields, keeps named tabs as groups', () => {
    expect(schema.map((f) => f.name)).toEqual(['title', 'sections', 'meta'])
    expect(schema[2]).toMatchObject({ type: 'group', label: 'SEO' })
  })
  it('keeps static defaults; function defaults need a request', () => {
    const hero = schema[1]!.blocks![0]!
    expect(hero.fields.find((f) => f.name === 'section')!.fields![0]!.defaultValue).toBe('white')
    expect(schema[2]!.fields![0]!.defaultValue).toBeUndefined()
  })
  it('labels like the admin does (toWords), and keeps string options as-is', () => {
    const bg = schema[1]!.blocks![0]!.fields.find((f) => f.name === 'section')!.fields![0]!
    expect(bg.options).toEqual([
      { label: 'White', value: 'white' },
      { label: 'light', value: 'light' },
    ])
    expect(schema[1]!.blocks![1]!.labels.singular).toBe('Gallery')
  })
  it('leaves out system, hidden, disabled, virtual and join fields', () => {
    const out = serializeFields([
      { name: 'title', type: 'text' },
      { name: 'updatedAt', type: 'date' },
      { name: '_status', type: 'select', options: ['draft'] },
      { name: 'secret', type: 'text', admin: { hidden: true } },
      { name: 'locked', type: 'text', admin: { disabled: true } },
      { name: 'computed', type: 'text', virtual: true },
      { name: 'related', type: 'join', collection: 'x', on: 'y' },
    ] as any)
    expect(out.map((f) => f.name)).toEqual(['title'])
  })
  it('resolves blockReferences from the global blocks', () => {
    const out = serializeFields(
      [{ name: 'layout', type: 'blocks', blocks: [], blockReferences: ['cta'] }] as any,
      {
        blocks: [{ slug: 'cta', fields: [{ name: 'label', type: 'text' }] }] as any,
      },
    )
    expect(out[0]!.blocks!.map((b) => b.slug)).toEqual(['cta'])
  })
  it('drops fields the user may not update (field permissions)', () => {
    const out = serializeFields(
      [
        { name: 'title', type: 'text' },
        { name: 'price', type: 'number' },
        {
          name: 'seo',
          type: 'group',
          fields: [
            { name: 'a', type: 'text' },
            { name: 'b', type: 'text' },
          ],
        },
      ] as any,
      {
        permissions: {
          title: { create: true, read: true, update: true },
          seo: { create: true, read: true, update: true, fields: { a: true } },
        } as any,
      },
    )
    expect(out.map((f) => f.name)).toEqual(['title', 'seo'])
    expect(out[1]!.fields!.map((f) => f.name)).toEqual(['a'])
  })
})

describe('preview tokens', () => {
  const secret = 's3cret'
  it('verifies a fresh token and rejects expired, foreign or tampered ones', async () => {
    const { token, payload } = await createPreviewToken(
      { ref: 'c:pages:5', path: '/home' },
      secret,
      60,
    )
    expect(await verifyPreviewToken(token, secret)).toMatchObject({
      ref: 'c:pages:5',
      path: '/home',
      jti: payload.jti,
    })
    expect(await verifyPreviewToken(token, 'other')).toBeNull()
    expect(await verifyPreviewToken(token, secret, Date.now() + 61_000)).toBeNull()
    const flipped = token.slice(0, -2) + (token.endsWith('A') ? 'B' : 'A') + token.slice(-1)
    expect(await verifyPreviewToken(flipped, secret)).toBeNull()
    expect(await verifyPreviewToken('garbage', secret)).toBeNull()
  })
})

describe('onpage() plugin', () => {
  const config: any = {
    collections: [
      {
        slug: 'pages',
        fields: [{ name: 'title', type: 'text' }],
        hooks: { afterRead: [() => undefined] },
      },
      { slug: 'media', fields: [{ name: 'alt', type: 'text' }] },
    ],
    globals: [{ slug: 'header', fields: [{ name: 'tagline', type: 'text' }] }],
  }
  const out: any = onpage({ collections: ['pages'], globals: ['header'] })(config)

  it('adds endpoints, hooks and admin controls only to enabled documents', () => {
    expect(out.endpoints.map((e: any) => `${e.method} ${e.path}`)).toEqual([
      'get /onpage/schema/:kind/:slug',
      'post /onpage/enter',
      'post /onpage/mode',
      'post /onpage/exit',
      'post /onpage/preview-link',
      'get /onpage/preview',
    ])
    const pages = out.collections.find((c: any) => c.slug === 'pages')
    expect(pages.hooks.afterRead).toHaveLength(2)
    expect(pages.hooks.beforeChange).toHaveLength(2)
    expect(pages.admin.components.edit.beforeDocumentControls[0].path).toBe(
      '@payload-onpage/plugin/admin#OnPageAdminControls',
    )
    expect(out.collections.find((c: any) => c.slug === 'media').hooks).toBeUndefined()
    expect(out.globals[0].admin.components.elements.beforeDocumentControls).toHaveLength(1)
  })

  it('marks reads only when asked, and strips markers from writes', async () => {
    const pages = out.collections.find((c: any) => c.slug === 'pages')
    const afterRead = pages.hooks.afterRead[1]
    const plain = afterRead({ doc: { id: 1, title: 'T' }, req: { locale: 'en' }, context: {} })
    expect(plain.title).toBe('T')
    const marked = afterRead({
      doc: { id: 1, title: 'T' },
      req: { locale: 'en' },
      context: { onpage: true },
    })
    expect(stegaDecode(marked.title)[0]).toMatchObject({ ref: 'c:pages:1', path: 'title' })
    const strip = pages.hooks.beforeChange[0]
    expect(strip({ data: { title: marked.title } })).toEqual({ title: 'T' })
    expect(wantsMarkers({ onpage: true })).toBe(true)
    expect(wantsMarkers({})).toBe(false)
  })

  it('is idempotent and can be disabled', () => {
    const twice: any = onpage({ collections: ['pages'] })(
      onpage({ collections: ['pages'] })({ ...config }) as any,
    )
    expect(twice.endpoints.filter((e: any) => e.path === '/onpage/enter')).toHaveLength(1)
    expect(twice.collections[0].hooks.afterRead).toHaveLength(2)
    expect(() => onpage({ collections: ['nope'] })(config)).toThrow(/unknown collection "nope"/)
    expect(onpage({ collections: ['pages'], enabled: false })(config)).toBe(config)
  })
})

describe('encodeDocument machine values', () => {
  it('never marks fields with a non-text editor or color-like names', () => {
    const fields: any[] = [
      { name: 'accent', type: 'text', label: 'Accent', editor: 'color' },
      { name: 'brandColor', type: 'text', label: 'Brand color' },
      { name: 'title', type: 'text', label: 'Title', editor: 'text' },
    ]
    const out: any = encodeDocument(
      { accent: '#fff', brandColor: '#000', title: 'Hi' },
      fields,
      'c:pages:1',
    )
    expect(out.accent).toBe('#fff')
    expect(out.brandColor).toBe('#000')
    expect(stegaDecode(out.title)[0]).toMatchObject({ path: 'title' })
  })
})
