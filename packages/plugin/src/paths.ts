/** Where a document lives on the site. */
import { safePath, type DocRef } from '@payload-onpage/core'
import type { PayloadRequest } from 'payload'
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
  locale?: string,
): Promise<string | null> {
  const localeArg = locale ? { locale: locale as never } : {}
  const doc =
    ref.kind === 'global'
      ? await req.payload
          .findGlobal({
            slug: ref.slug as never,
            draft: true,
            depth: 0,
            overrideAccess: true,
            ...localeArg,
          })
          .catch(() => null)
      : await req.payload
          .findByID({
            collection: ref.slug as never,
            id: ref.id,
            draft: true,
            depth: 0,
            overrideAccess: true,
            ...localeArg,
          })
          .catch(() => null)
  if (!doc) return null

  let url: string | null | undefined
  if (entry.options.url) url = await entry.options.url({ doc, locale, req })
  else if (ref.kind === 'collection') {
    const preview = req.payload.collections[ref.slug]?.config.admin?.preview
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
