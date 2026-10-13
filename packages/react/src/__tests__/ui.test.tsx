// @vitest-environment happy-dom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  stegaDecode,
  stegaEncode,
  type DataSource,
  type DocumentSchema,
  type MediaLibrary,
} from '@payload-onpage/core'
import { OnPageClient } from '../OnPageClient.tsx'
import { OnPageEditor } from '../editor/OnPageEditor.tsx'
import { hub } from '../hub.ts'
import { sanitizeHtml } from '../sanitize.ts'

const schema: DocumentSchema = {
  kind: 'collection',
  slug: 'pages',
  labels: { singular: 'Page', plural: 'Pages' },
  editable: ['title', 'layout', 'author', 'image'],
  drafts: true,
  relations: { users: { titleField: 'name', label: 'User' } },
  fields: [
    { name: 'title', type: 'text', label: 'Title' },
    { name: 'author', type: 'relationship', label: 'Author', relationTo: 'users' },
    { name: 'image', type: 'upload', label: 'Image', relationTo: 'media' },
    {
      name: 'layout',
      type: 'blocks',
      label: 'Layout',
      blocks: [
        {
          slug: 'hero',
          labels: { singular: 'Hero', plural: 'Heroes' },
          fields: [
            { name: 'heading', type: 'text', label: 'Heading' },
            {
              name: 'tone',
              type: 'select',
              label: 'Tone',
              options: [
                { label: 'Light', value: 'light' },
                { label: 'Dark', value: 'dark' },
              ],
            },
          ],
        },
        {
          slug: 'cta',
          labels: { singular: 'Call to action', plural: 'CTAs' },
          fields: [{ name: 'label', type: 'text', label: 'Label' }],
        },
      ],
    },
  ],
}
const initial = () => ({
  id: 1,
  updatedAt: 'v0',
  title: 'Hello',
  author: null,
  image: null,
  layout: [{ id: 'h', blockType: 'hero', heading: 'Big', tone: 'light' }],
})

function source(extra: Partial<DataSource> = {}) {
  const saves: Record<string, unknown>[] = []
  const ds: DataSource = {
    loadSchema: async () => schema,
    loadDocument: async () => initial(),
    saveDraft: async (_r, data) => (saves.push(data), { ok: true }),
    publish: async () => ({ ok: true }),
    search: async (_c, o) =>
      [{ id: 7, title: 'Ada', doc: { id: 7, name: 'Ada' } }].filter(
        (h) => !o.query || h.title.includes(o.query),
      ),
    ...extra,
  }
  return { ds, saves }
}

const media: MediaLibrary = {
  search: async () => ({
    items: [
      {
        id: 3,
        url: '/a.png',
        thumbnailUrl: '/a.png',
        alt: 'A',
        filename: 'a.png',
        doc: { id: 3, url: '/a.png', alt: 'A' },
      },
    ],
    hasMore: false,
  }),
}

async function mountEditor(ds: DataSource, html: string, mediaLibrary: MediaLibrary = media) {
  document.body.innerHTML = html
  const container = document.createElement('div')
  document.body.appendChild(container)
  render(
    <OnPageEditor
      dataSource={ds}
      media={mediaLibrary}
      links={{ exit: '/exit', mode: (m) => `/mode?mode=${m}` }}
      autosaveDelay={0}
    />,
    { container },
  )
  await waitFor(() => expect(screen.getByTestId('onpage-status').textContent).toBe('Editing draft'))
}

const ann = (extra: string) => `data-onpage-ref="c:pages:1" ${extra}`

describe('row toolbar, settings and block picker', () => {
  // happy-dom has no layout: give elements an on-screen box so the overlay draws.
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 400,
      left: 0,
      right: 800,
      width: 800,
      height: 300,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    })
  })
  afterEach(() => vi.restoreAllMocks())
  const html = `<div ${ann('data-onpage-list="layout"')}><section ${ann('data-onpage-row="layout.0"')}><h2 ${ann('data-onpage-field="layout.0.heading"')}>Big</h2></section></div>`

  it('selecting a section shows its toolbar; settings edit a select; add section inserts a block', async () => {
    const { ds, saves } = source()
    await mountEditor(ds, html)
    fireEvent.click(document.querySelector('section')!)
    const toolbar = await screen.findByTestId('onpage-block-toolbar')
    expect(toolbar.getAttribute('aria-label')).toBe('Hero actions')
    fireEvent.click(screen.getByTestId('onpage-block-settings'))
    const settings = await screen.findByRole('dialog', { name: 'Hero settings' })
    const dark = settings.querySelector(
      '[data-testid="onpage-setting-layout.0.tone-dark"]',
    ) as HTMLElement
    expect(dark.getAttribute('role')).toBe('radio')
    fireEvent.click(dark)
    await waitFor(() => expect(saves.at(-1)).toMatchObject({ layout: [{ tone: 'dark' }] }))
    fireEvent.click(settings.querySelector('.po-close') as HTMLElement)
    fireEvent.click(screen.getByTestId('onpage-insert-below'))
    fireEvent.click(await screen.findByTestId('onpage-block-cta'))
    await waitFor(() =>
      expect(saves.at(-1)).toMatchObject({ layout: [{ blockType: 'hero' }, { blockType: 'cta' }] }),
    )
  })

  it('duplicate and delete, with undo', async () => {
    const { ds, saves } = source()
    await mountEditor(ds, html)
    fireEvent.click(document.querySelector('section')!)
    fireEvent.click(await screen.findByTestId('onpage-block-duplicate'))
    await waitFor(() => expect((saves.at(-1)?.layout as unknown[]).length).toBe(2))
    const dup = saves.at(-1)!.layout as Array<{ id: string }>
    expect(dup[0]!.id).not.toBe(dup[1]!.id) // fresh row id
  })
})

describe('relationship and upload editors', () => {
  it('relationship: searches by the title field and stores the populated doc', async () => {
    const { ds, saves } = source()
    await mountEditor(ds, `<span ${ann('data-onpage-field="author"')}>No author</span>`)
    fireEvent.click(document.querySelector('span')!)
    const option = await screen.findByTestId('onpage-relationship-7', undefined, { timeout: 2000 })
    fireEvent.click(option)
    await waitFor(() => expect(saves.at(-1)).toEqual({ author: 7 })) // saved as an id
  })
  it('upload: picks an image through the MediaLibrary port', async () => {
    const { ds, saves } = source()
    await mountEditor(
      ds,
      `<img alt="" ${ann('data-onpage-field="image" data-onpage-kind="media"')}>`,
    )
    fireEvent.click(document.querySelector('img')!)
    fireEvent.click(await screen.findByTestId('onpage-media-3', undefined, { timeout: 2000 }))
    await waitFor(() => expect(saves.at(-1)).toEqual({ image: 3 }))
  })
  it('upload: asks for alt text before uploading a new file', async () => {
    const { ds, saves } = source()
    const upload = vi.fn<NonNullable<MediaLibrary['upload']>>(async () => ({
      id: 9,
      url: '/cat.png',
      alt: 'A cat asleep',
      doc: { id: 9, url: '/cat.png', alt: 'A cat asleep' },
    }))
    URL.createObjectURL ??= () => 'blob:x'
    URL.revokeObjectURL ??= () => undefined
    await mountEditor(
      ds,
      `<img alt="" ${ann('data-onpage-field="image" data-onpage-kind="media"')}>`,
      { ...media, upload },
    )
    fireEvent.click(document.querySelector('img')!)
    await screen.findByTestId('onpage-media-upload')
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!
    fireEvent.change(input, { target: { files: [new File(['x'], 'IMG_2034.png')] } })
    expect(upload).not.toHaveBeenCalled() // waits for the alt text
    fireEvent.change(await screen.findByTestId('onpage-media-alt'), {
      target: { value: '  A cat asleep ' },
    })
    fireEvent.submit(screen.getByTestId('onpage-media-alt-form'))
    await waitFor(() => expect(saves.at(-1)).toEqual({ image: 9 }))
    expect(upload).toHaveBeenCalledWith(expect.any(File), {
      relationTo: 'media',
      alt: 'A cat asleep',
    })
  })
  it("upload: edits the current image's alt text on the media document", async () => {
    const marked = stegaEncode('Old words', { ref: 'c:pages:1', path: 'image', kind: 'media' })
    const { ds, saves } = source({
      loadDocument: async () => ({ ...initial(), image: { id: 3, url: '/a.png', alt: marked } }),
    })
    const updateAlt = vi.fn<NonNullable<MediaLibrary['updateAlt']>>(async (id, { alt }) => ({
      id,
      url: '/a.png',
      alt,
      doc: { id, url: '/a.png', alt },
    }))
    await mountEditor(
      ds,
      `<img alt="" ${ann('data-onpage-field="image" data-onpage-kind="media"')}>`,
      { ...media, updateAlt },
    )
    fireEvent.click(document.querySelector('img')!)
    const field = await screen.findByTestId<HTMLInputElement>('onpage-media-alt-current')
    expect(field.value).toBe('Old words') // without the marker
    fireEvent.change(field, { target: { value: 'A red door' } })
    fireEvent.submit(field.closest('form')!)
    await waitFor(() =>
      expect(updateAlt).toHaveBeenCalledWith(3, { relationTo: 'media', alt: 'A red door' }),
    )
    await waitFor(() => expect(saves.at(-1)).toEqual({ image: 3 }))
  })
})

describe('page settings', () => {
  it("lists the document's fields that aren't on the page, and edits them", async () => {
    const withMeta: DocumentSchema = {
      ...schema,
      editable: [...schema.editable, 'slug', 'meta'],
      fields: [
        ...schema.fields,
        { name: 'slug', type: 'text', label: 'Slug' },
        {
          name: 'meta',
          type: 'group',
          label: 'SEO',
          fields: [
            { name: 'title', type: 'text', label: 'Meta title' },
            { name: 'description', type: 'textarea', label: 'Meta description' },
          ],
        },
      ],
    }
    const { ds, saves } = source({
      loadSchema: async () => withMeta,
      loadDocument: async () => ({ ...initial(), slug: 'home', meta: { title: 'Home' } }),
    })
    // The title is on the page; everything else isn't.
    await mountEditor(ds, `<span ${ann('data-onpage-field="title"')}>Hello</span>`)
    fireEvent.click(screen.getByTestId('onpage-page-settings-open'))
    const panel = await screen.findByTestId('onpage-page-settings')
    const labels = [...panel.querySelectorAll('label, legend')].map((l) => l.textContent)
    expect(labels).toEqual(expect.arrayContaining(['Author', 'Image', 'SEO', 'Meta title']))
    expect(labels).not.toContain('Title') // edited on the page
    expect(labels).not.toContain('Slug') // the page's own address
    const metaTitle = screen.getByLabelText('Meta title')
    fireEvent.change(metaTitle, { target: { value: 'Welcome' } })
    fireEvent.blur(metaTitle)
    await waitFor(() => expect(saves.at(-1)).toMatchObject({ meta: { title: 'Welcome' } }))
  })
})

describe('publish panel', () => {
  it('publishes the chosen documents, or schedules them', async () => {
    const published: unknown[] = []
    const schedulePublish = vi.fn<NonNullable<DataSource['schedulePublish']>>(async (_r, o) => ({
      id: 1,
      waitUntil: o.at.toISOString(),
      type: 'publish',
    }))
    const { ds } = source({
      loadSchema: async () => ({ ...schema, schedulePublish: true }),
      loadDocument: async () => ({ ...initial(), _status: 'draft' }),
      publish: async (ref) => (published.push(ref), { ok: true }),
      schedulePublish,
    })
    await mountEditor(ds, `<span ${ann('data-onpage-field="title"')}>Hello</span>`)
    fireEvent.click(screen.getByTestId('onpage-publish-more'))
    const doc = await screen.findByTestId<HTMLInputElement>('onpage-publish-doc-c:pages:1')
    expect(doc.checked).toBe(true) // has unpublished changes
    expect(screen.getByText('Hello')).toBeTruthy()
    // Schedule an hour from now.
    const at = new Date(Date.now() + 3600_000)
    const local = new Date(at.getTime() - at.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16)
    fireEvent.change(screen.getByTestId('onpage-schedule-at'), { target: { value: local } })
    fireEvent.click(screen.getByTestId('onpage-schedule'))
    await waitFor(() => expect(schedulePublish).toHaveBeenCalledTimes(1))
    expect(schedulePublish.mock.calls[0]![0]).toMatchObject({ slug: 'pages', id: 1 })
    expect(published).toEqual([]) // scheduling doesn't publish now
    await waitFor(() => expect(screen.queryByTestId('onpage-publish-panel')).toBeNull())
    // Publish now, through the panel.
    fireEvent.click(screen.getByTestId('onpage-publish-more'))
    fireEvent.click(await screen.findByTestId('onpage-publish-selected'))
    await waitFor(() => expect(published).toHaveLength(1))
  })
})

describe('OnPageClient', () => {
  it('renders the given doc without an editor, with inert annotations', () => {
    hub.set(null)
    render(
      <OnPageClient
        collection="pages"
        doc={{ id: 1, title: 'Static' }}
        render={(d, e) => <h1 {...e.field('title')}>{d.title}</h1>}
      />,
    )
    expect(screen.getByRole('heading').textContent).toBe('Static')
    expect(screen.getByRole('heading').hasAttribute('data-onpage-ref')).toBe(false)
  })
  it('inside an editor: renders editor state with markers and live annotations', async () => {
    const { ds } = source()
    document.body.innerHTML = ''
    const host = document.createElement('div')
    document.body.appendChild(host)
    render(
      <>
        <OnPageEditor dataSource={ds} links={{ exit: '/exit' }} />
        <OnPageClient
          collection="pages"
          doc={initial()}
          render={(d, e) => <h1 {...e.field('title')}>{d.title}</h1>}
        />
      </>,
      { container: host },
    )
    await waitFor(() =>
      expect(stegaDecode(screen.getByRole('heading').textContent ?? '')[0]).toMatchObject({
        path: 'title',
      }),
    )
    expect(screen.getByRole('heading').getAttribute('data-onpage-ref')).toBe('c:pages:1')
  })
})

describe('sanitizeHtml and hub', () => {
  it('drops scripts, handlers and unsafe URLs', () => {
    const out = sanitizeHtml(
      '<p onclick="x()">Hi <a href="javascript:alert(1)">x</a><a href="/ok">ok</a><script>bad()</script><img src="data:x" onerror="y()"></p>',
    )
    expect(out).not.toMatch(/onclick|onerror|javascript:|script|data:/)
    expect(out).toContain('href="/ok"')
  })
  it('is one shared store, even across module copies', () => {
    const seen = vi.fn()
    const off = hub.subscribe(seen)
    act(() => hub.set(null))
    expect((globalThis as Record<symbol, unknown>)[Symbol.for('payload-onpage.hub')]).toBeTruthy()
    off()
  })
})
