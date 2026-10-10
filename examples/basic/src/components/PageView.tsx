/**
 * Renders a page. Plain markup, usable from server components (refresh mode)
 * and from <OnPageClient> (client mode). Text needs no annotations: in edit
 * mode it carries invisible markers. Annotations (`e.*`) mark what markers
 * can't reach: non-text values (date, relationship, color, select).
 */
import React from 'react'
import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Editable } from '@payload-onpage/react/annotations'

type Doc = Record<string, any>

const ICONS: Record<string, string> = { star: '★', bolt: '⚡', heart: '♥' }
const date = (iso?: string | null) =>
  iso ? new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(iso)) : 'No date'

export function PageView({ page, e }: { page: Doc; e: Editable }) {
  const author = page.author && typeof page.author === 'object' ? page.author.name || page.author.email : null
  return (
    <main style={{ ['--accent' as string]: page.accent || '#4f46e5' }} data-testid="page">
      <div className="meta">
        <span className="swatch" title="Accent color" {...e.field('accent', 'field', 'Accent color')} />
        <span {...e.field('publishedAt', 'field', 'Publish date')}>{date(page.publishedAt)}</span>
        <span>·</span>
        <span {...e.field('author', 'field', 'Author')}>{author ?? 'No author'}</span>
      </div>
      <div {...e.list('layout', 'Section')}>
        {(page.layout ?? []).map((block: Doc, i: number) => (
          <Block key={block.id ?? i} block={block} path={`layout.${i}`} e={e} />
        ))}
      </div>
    </main>
  )
}

function Block({ block, path, e }: { block: Doc; path: string; e: Editable }) {
  switch (block.blockType) {
    case 'hero': {
      const img = block.image && typeof block.image === 'object' ? block.image : null
      return (
        <section className={`hero tone-${block.tone ?? 'light'}`} {...e.row(path, 'Hero')}>
          <div>
            <h1>{block.heading}</h1>
            {block.subheading && <p>{block.subheading}</p>}
            {block.cta?.label && (
              <a className="button" href={block.cta.url || '#'}>
                {block.cta.label}
              </a>
            )}
          </div>
          {img?.url && <img src={img.url} alt={img.alt ?? ''} />}
        </section>
      )
    }
    case 'features':
      return (
        <section className="features" {...e.row(path, 'Features')}>
          {block.heading && <h2>{block.heading}</h2>}
          <ul className={`cols-${block.columns ?? '3'}`} {...e.list(`${path}.items`, 'Feature')}>
            {(block.items ?? []).map((item: Doc, j: number) => (
              <li key={item.id ?? j} {...e.row(`${path}.items.${j}`, 'Feature')}>
                <span className="icon" {...e.field(`${path}.items.${j}.icon`, 'field', 'Icon')}>
                  {ICONS[item.icon] ?? '★'}
                </span>
                <h3>{item.title}</h3>
                {item.description && <p>{item.description}</p>}
              </li>
            ))}
          </ul>
        </section>
      )
    case 'content':
      return (
        <section className="content" {...e.row(path, 'Content')}>
          {block.body && <RichText data={block.body} />}
        </section>
      )
    default:
      return null
  }
}
