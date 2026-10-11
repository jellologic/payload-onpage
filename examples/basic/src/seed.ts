/** Seeds a fresh database with an editor account, two pages and the header, so the example works on first run. */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Payload } from 'payload'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const p = (text: string) => ({
  type: 'paragraph',
  version: 1,
  format: '',
  indent: 0,
  direction: 'ltr',
  textFormat: 0,
  children: [{ type: 'text', version: 1, text, format: 0, detail: 0, mode: 'normal', style: '' }],
})
const h = (tag: 'h2' | 'h3', text: string) => ({ ...p(text), type: 'heading', tag })
const rich = (...children: unknown[]): any => ({
  root: { type: 'root', version: 1, format: '', indent: 0, direction: 'ltr', children },
})

export async function seed(payload: Payload) {
  const { totalDocs } = await payload.count({ collection: 'users' })
  if (totalDocs > 0) return
  payload.logger.info('payload-onpage example: seeding…')

  const user = await payload.create({
    collection: 'users',
    data: { email: 'dev@example.com', password: 'test', name: 'Dev Editor', role: 'admin' },
  })
  await payload.create({
    collection: 'users',
    data: { email: 'editor@example.com', password: 'test', name: 'Edith Editor', role: 'editor' },
  })
  const hero = await payload.create({
    collection: 'media',
    data: { alt: 'Abstract violet to pink gradient' },
    filePath: path.resolve(dirname, '../seed/hero.png'),
  })
  const alt = await payload.create({
    collection: 'media',
    data: { alt: 'Abstract green to blue gradient' },
    filePath: path.resolve(dirname, '../seed/alt.png'),
  })
  void alt

  await payload.updateGlobal({
    slug: 'header',
    data: {
      siteName: 'Acme Studio',
      tagline: 'Edit me on the page',
      nav: [
        { label: 'Home', href: '/' },
        { label: 'About', href: '/about' },
      ],
      _status: 'published',
    },
  })

  await payload.create({
    collection: 'pages',
    data: {
      title: 'Home',
      slug: 'home',
      publishedAt: new Date().toISOString(),
      author: user.id,
      accent: '#4f46e5',
      _status: 'published',
      layout: [
        {
          blockType: 'hero',
          heading: 'Click any text on this page to edit it',
          subheading:
            'payload-onpage maps what you see back to Payload fields. Nothing on this page was annotated by hand except the image, the date and the accent color.',
          image: hero.id,
          cta: { label: 'Read the guide', url: 'https://github.com/jellologic/payload-onpage' },
          tone: 'dark',
        },
        {
          blockType: 'features',
          heading: 'What you can do',
          columns: '3',
          items: [
            {
              title: 'Edit text in place',
              description: 'Headings, paragraphs and rich text, right where they render.',
              icon: 'star',
            },
            {
              title: 'Rearrange sections',
              description: 'Move, duplicate and delete blocks and array rows from the toolbar.',
              icon: 'bolt',
            },
            {
              title: 'Share a draft',
              description: 'Copy a signed, expiring link that shows the draft to anyone.',
              icon: 'heart',
            },
          ],
        },
        {
          blockType: 'content',
          body: rich(
            h('h2', 'Rich text, edited inline'),
            p('Select some words and make them bold, add a link, or turn a line into a heading.'),
            p(
              'Saves go through Payload REST, so drafts, versions, hooks and access control apply.',
            ),
          ),
        },
      ],
    },
  })

  await payload.create({
    collection: 'pages',
    data: {
      title: 'About',
      slug: 'about',
      instant: true,
      accent: '#059669',
      _status: 'published',
      layout: [
        {
          blockType: 'hero',
          heading: 'This page renders in client mode',
          subheading:
            'Edits show instantly, without a server round trip, because the page renders from the editor state with <OnPageClient>.',
          tone: 'light',
        },
        {
          blockType: 'content',
          body: rich(
            p('Compare with the home page, which refreshes from the server after each save.'),
          ),
        },
      ],
    },
  })
  payload.logger.info('payload-onpage example: seeded. Sign in as dev@example.com / test')
}
