/** Where a document lives on the site. */
import { safePath, type DocRef } from '@payload-onpage/core'
import type { PayloadRequest, TypedLocale } from 'payload'
import { originOf } from './http.ts'
import type { Entry } from './options.ts'

/**
 * The site path that shows a document: the entry's `url` option, else the
 * collection's `admin.preview` URL, else `/<slug>`; globals default to "/".
 * Absolute URLs must be same-origin. Returns null when there's no page.
 */
export async function resolvePath(
  req: PayloadRequest,
  ref: DocRef,
  entry: Entry,
  locale?: TypedLocale,
): Promise<string | null> {
  const read = { draft: true, depth: 0, overrideAccess: true, ...(locale ? { locale } : {}) }
  const doc: Record<string, unknown> | null =
    entry.kind === 'global'
      ? await req.payload.findGlobal({ slug: entry.slug, ...read }).catch(() => null)
      : ref.kind === 'collection'
        ? await req.payload
            .findByID({ collection: entry.slug, id: ref.id, ...read })
            .catch(() => null)
        : null
  if (!doc) return null

  let url: string | null | undefined
  if (entry.options.url) url = await entry.options.url({ doc, locale: locale ?? undefined, req })
  else if (entry.kind === 'collection') {
    const preview = req.payload.collections[entry.slug]?.config.admin?.preview
    if (preview) url = await preview(doc, { locale: locale ?? '', req, token: null })
    if (!url && typeof doc.slug === 'string') url = `/${doc.slug.replace(/^\/+/, '')}`
  } else url = '/'
  if (!url) return null

  const origin = originOf(req)
  try {
    const u = new URL(url, origin)
    if (u.origin !== origin) return null
    return safePath(u.pathname + u.search)
  } catch {
    return null
  }
}
