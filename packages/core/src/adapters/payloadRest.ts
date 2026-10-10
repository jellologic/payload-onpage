/**
 * Default adapters over Payload's REST API (cookie auth, same origin):
 *   payloadRest()     DataSource for collections and globals
 *   payloadUploads()  MediaLibrary over an upload collection
 * Every write is a normal PATCH, so access control, hooks, validation, drafts
 * and versions behave exactly as in the admin.
 */
import type { DocRef } from '../docref.ts'
import type { DataSource, Doc, MediaItem, MediaLibrary, SaveResult, SearchHit } from '../ports.ts'
import type { DocumentSchema } from '../schema.ts'

export interface PayloadRestOptions {
  /** API base, default "/api". */
  apiBase?: string
  /** Plugin endpoint prefix, default "/onpage". */
  prefix?: string
  /** Extra request init (headers for a custom auth scheme, etc.). */
  init?: RequestInit
  fetch?: typeof fetch
}

const qs = (params: Record<string, string | number | boolean | undefined>) => {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') s.set(k, String(v))
  return s.toString()
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json()
    const first = body?.errors?.[0]
    const detail = first?.data?.errors?.[0]?.message
    return [first?.message ?? body?.error ?? res.statusText, detail].filter(Boolean).join(': ')
  } catch {
    return res.statusText || `HTTP ${res.status}`
  }
}

export function payloadRest(opts: PayloadRestOptions = {}): DataSource {
  const api = opts.apiBase ?? '/api'
  const prefix = opts.prefix ?? '/onpage'
  const f = opts.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a))
  const init = (extra: RequestInit = {}): RequestInit => ({
    credentials: 'include',
    ...opts.init,
    ...extra,
    headers: { ...(opts.init?.headers ?? {}), ...(extra.headers ?? {}) },
  })
  const docUrl = (ref: DocRef) =>
    ref.kind === 'global' ? `${api}/globals/${ref.slug}` : `${api}/${ref.slug}/${ref.id}`

  const write = async (
    ref: DocRef,
    data: Doc,
    o: { locale?: string; updatedAt?: string },
    publish: boolean,
  ): Promise<SaveResult> => {
    const query = qs({
      locale: o.locale,
      depth: 0,
      draft: publish ? undefined : true,
      autosave: publish ? undefined : true,
    })
    const body = {
      ...data,
      ...(o.updatedAt ? { updatedAt: o.updatedAt } : {}),
      ...(publish ? { _status: 'published' } : {}),
    }
    const res = await f(
      `${docUrl(ref)}?${query}`,
      init({
        method: ref.kind === 'global' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    )
    if (!res.ok) return { ok: false, status: res.status, message: await errorMessage(res) }
    const json = await res.json().catch(() => ({}))
    const doc = json?.doc ?? json?.result ?? json
    return { ok: true, updatedAt: typeof doc?.updatedAt === 'string' ? doc.updatedAt : undefined }
  }

  return {
    async loadSchema(ref, o): Promise<DocumentSchema> {
      const res = await f(
        `${api}${prefix}/schema/${ref.kind}/${ref.slug}?${qs({ locale: o.locale })}`,
        init(),
      )
      if (!res.ok) throw new Error(`Schema for ${ref.slug}: ${await errorMessage(res)}`)
      return res.json()
    },
    async loadDocument(ref, o) {
      const res = await f(
        `${docUrl(ref)}?${qs({ draft: o.draft, depth: o.depth ?? 2, locale: o.locale })}`,
        init(),
      )
      if (!res.ok) throw new Error(await errorMessage(res))
      return res.json()
    },
    saveDraft: (ref, data, o) => write(ref, data, o, false),
    publish: (ref, data, o) => write(ref, data, o, true),
    async search(collection, o): Promise<SearchHit[]> {
      const res = await f(
        `${api}${prefix}/search/${collection}?${qs({ q: o.query, locale: o.locale, limit: o.limit })}`,
        init(),
      )
      if (!res.ok) throw new Error(await errorMessage(res))
      return (await res.json()).docs ?? []
    },
  }
}

export interface PayloadUploadsOptions {
  apiBase?: string
  pageSize?: number
  fetch?: typeof fetch
}

function thumbOf(doc: Doc): string | undefined {
  const sizes = (doc.sizes ?? {}) as Record<string, { url?: string | null } | undefined>
  for (const key of ['thumbnail', 'small', 'card', 'medium']) {
    const u = sizes[key]?.url
    if (u) return u
  }
  return (doc.url as string | undefined) ?? undefined
}

const toItem = (doc: Doc): MediaItem => ({
  id: doc.id as string | number,
  url: (doc.url as string) ?? null,
  thumbnailUrl: thumbOf(doc) ?? null,
  alt: (doc.alt as string) ?? null,
  filename: (doc.filename as string) ?? null,
  doc,
})

export function payloadUploads(opts: PayloadUploadsOptions = {}): MediaLibrary {
  const api = opts.apiBase ?? '/api'
  const f = opts.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a))
  return {
    async search({ query, page = 1, relationTo }) {
      const p = new URLSearchParams({
        depth: '0',
        limit: String(opts.pageSize ?? 30),
        page: String(page),
        sort: '-createdAt',
      })
      p.set('where[and][0][mimeType][contains]', 'image')
      if (query) {
        p.set('where[and][1][or][0][filename][like]', query)
        p.set('where[and][1][or][1][alt][like]', query)
      }
      const res = await f(`${api}/${relationTo}?${p}`, { credentials: 'include' })
      if (!res.ok) throw new Error(await errorMessage(res))
      const body = await res.json()
      return { items: (body.docs ?? []).map(toItem), hasMore: Boolean(body.hasNextPage) }
    },
    async upload(file, { relationTo, alt }) {
      const form = new FormData()
      form.append('file', file)
      // Document fields must go in `_payload`; loose multipart parts are ignored by Payload.
      form.append(
        '_payload',
        JSON.stringify({ alt: alt ?? file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') }),
      )
      const res = await f(`${api}/${relationTo}`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      if (!res.ok) throw new Error(await errorMessage(res))
      return toItem((await res.json()).doc)
    },
  }
}
