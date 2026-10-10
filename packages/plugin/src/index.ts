/**
 * @payload-onpage/plugin — the Payload side of payload-onpage.
 *
 *   plugins: [onpage({ collections: ['pages'], globals: ['header'], session: nextSession() })]
 *
 * Adds, under /api/onpage:
 *   GET  /schema/:kind/:slug   editable field schema (with static defaults)
 *   GET  /enter                start editing (or previewing) and redirect to the page
 *   GET  /exit                 leave edit/preview mode
 *   GET  /mode?mode=view|edit  switch the current page between editing and previewing
 *   GET  /search/:slug?q=      find documents by title (relationship editor)
 *   POST /preview-link         signed, expiring read-only draft link
 *   GET  /preview?token=       open a preview link
 * plus auto-mapping (stega markers on reads that ask for it), marker stripping
 * on every write, and "Edit on page" / "Copy preview link" in the admin.
 *
 * Writes from the editor go through Payload's normal REST API, so access
 * control, hooks, validation, drafts and versions apply unchanged.
 */
import type {
  CollectionConfig,
  Config,
  Endpoint,
  GlobalConfig,
  Payload,
  PayloadRequest,
  Plugin,
} from 'payload'
import {
  isSafePath,
  parseRefKey,
  refKey,
  serializeFields,
  stegaCleanDeep,
  encodeDocument,
  type EncodeFilter,
  type DocRef,
  type DocumentSchema,
  type OnPageMode,
  type SchemaField,
  type SessionAdapter,
} from '@payload-onpage/core'

import { createPreviewToken, verifyPreviewToken } from './tokens.ts'

export interface OnPageDocOptions {
  /** Top-level fields editable on the page. Default: all top-level data fields. */
  fields?: string[]
  /**
   * The site path that shows this document. Default for collections:
   * `admin.preview` if it returns a URL, else `/${doc.slug}`. Globals: "/".
   */
  url?: (args: {
    doc: Record<string, unknown>
    locale?: string
    req: PayloadRequest
  }) => string | null | Promise<string | null>
}

export interface OnPageOptions {
  collections?: string[] | Record<string, OnPageDocOptions | true>
  globals?: string[] | Record<string, OnPageDocOptions | true>
  /** Who may edit (and create preview links). Default: the document's own update access. */
  access?: (args: { req: PayloadRequest; ref: DocRef }) => boolean | Promise<boolean>
  /** Framework adapter that switches edit/preview mode on and off (e.g. nextSession()). */
  session?: SessionAdapter
  /** Narrow which strings get auto-mapping markers. */
  encode?: EncodeFilter
  /** Lifetime of shareable preview links, in seconds. Default 7 days. */
  previewLinkTTL?: number
  /** Endpoint prefix under the API route. Default "/onpage". */
  routePrefix?: string
  enabled?: boolean
}

type Entry = { kind: 'collection' | 'global'; slug: string; options: OnPageDocOptions }

const normalize = (input: OnPageOptions['collections'], kind: Entry['kind']): Entry[] =>
  Array.isArray(input)
    ? input.map((slug) => ({ kind, slug, options: {} }))
    : Object.entries(input ?? {}).map(([slug, o]) => ({ kind, slug, options: o === true ? {} : o }))

/** True when a read asked for auto-mapping markers (see onpageContext()). */
export const wantsMarkers = (context: unknown) =>
  !!(context && typeof context === 'object' && (context as Record<string, unknown>).onpage === true)

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } })

function originOf(req: PayloadRequest): string {
  const configured = req.payload.config.serverURL
  if (configured) return configured.replace(/\/$/, '')
  try {
    return new URL((req as unknown as { url: string }).url).origin
  } catch {
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost'
    const proto = req.headers.get('x-forwarded-proto') ?? 'http'
    return `${proto}://${host}`
  }
}

const isSecure = (req: PayloadRequest) => originOf(req).startsWith('https:')

export function onpage(options: OnPageOptions): Plugin {
  return (incoming: Config): Config => {
    if (options.enabled === false) return incoming
    const prefix = options.routePrefix ?? '/onpage'
    const entries = [
      ...normalize(options.collections, 'collection'),
      ...normalize(options.globals, 'global'),
    ]
    const byKey = new Map(entries.map((e) => [`${e.kind}:${e.slug}`, e]))
    const schemaCache = new Map<string, SchemaField[]>()
    const apiRoute = incoming.routes?.api ?? '/api'

    const fieldsFor = (cfg: CollectionConfig | GlobalConfig, kind: string): SchemaField[] => {
      const k = `${kind}:${cfg.slug}`
      let f = schemaCache.get(k)
      if (!f) {
        f = serializeFields(cfg.fields as never)
        schemaCache.set(k, f)
      }
      return f
    }

    // ── access ──────────────────────────────────────────────────────────────
    const canEdit = async (req: PayloadRequest, ref: DocRef): Promise<boolean> => {
      if (!req.user) return false
      if (!byKey.has(`${ref.kind}:${ref.slug}`)) return false
      if (options.access) return Boolean(await options.access({ req, ref }))
      const access =
        ref.kind === 'global'
          ? req.payload.globals.config.find((g) => g.slug === ref.slug)?.access?.update
          : req.payload.collections[ref.slug]?.config.access?.update
      if (!access) return true
      const result = await (access as (a: unknown) => unknown)({
        req,
        id: ref.kind === 'collection' ? ref.id : undefined,
      })
      return result !== false
    }

    // ── where does a document live on the site? ─────────────────────────────
    const resolvePath = async (
      req: PayloadRequest,
      ref: DocRef,
      locale?: string,
    ): Promise<string | null> => {
      const entry = byKey.get(`${ref.kind}:${ref.slug}`)
      if (!entry) return null
      const doc =
        ref.kind === 'global'
          ? await req.payload.findGlobal({
              slug: ref.slug as never,
              draft: true,
              depth: 0,
              overrideAccess: true,
              ...(locale ? { locale: locale as never } : {}),
            })
          : await req.payload
              .findByID({
                collection: ref.slug as never,
                id: ref.id,
                draft: true,
                depth: 0,
                overrideAccess: true,
                ...(locale ? { locale: locale as never } : {}),
              })
              .catch(() => null)
      if (!doc) return null
      const d = doc as Record<string, unknown>
      let url: string | null | undefined
      if (entry.options.url) url = await entry.options.url({ doc: d, locale, req })
      else if (ref.kind === 'collection') {
        const preview = req.payload.collections[ref.slug]?.config.admin?.preview
        if (preview) url = await preview(d, { locale: locale ?? '', req, token: null } as never)
        if (!url && typeof d.slug === 'string') url = `/${d.slug.replace(/^\/+/, '')}`
      } else url = '/'
      if (!url) return null
      // Absolute same-origin URLs become paths.
      try {
        const u = new URL(url, originOf(req))
        if (u.origin !== originOf(req)) return null
        url = u.pathname + u.search
      } catch {
        return null
      }
      return isSafePath(url) ? url : null
    }

    const readRef = (params: URLSearchParams): DocRef | null => {
      const kind = params.get('kind') === 'global' ? 'global' : 'collection'
      const slug = params.get('slug') ?? ''
      if (!slug) return null
      if (kind === 'global') return { kind, slug }
      const id = params.get('id')
      return id ? { kind, slug, id: /^\d+$/.test(id) ? Number(id) : id } : null
    }

    const params = (req: PayloadRequest) =>
      new URL((req as unknown as { url: string }).url, 'http://x').searchParams

    // ── endpoints ───────────────────────────────────────────────────────────
    const schemaEndpoint: Endpoint = {
      path: `${prefix}/schema/:kind/:slug`,
      method: 'get',
      handler: async (req) => {
        const kind = req.routeParams?.kind === 'global' ? 'global' : 'collection'
        const slug = String(req.routeParams?.slug ?? '')
        const entry = byKey.get(`${kind}:${slug}`)
        const cfg =
          kind === 'global'
            ? req.payload.globals.config.find((g) => g.slug === slug)
            : req.payload.collections[slug]?.config
        if (!entry || !cfg)
          return Response.json({ error: 'Not enabled for on-page editing' }, { status: 404 })
        const probe: DocRef = kind === 'global' ? { kind, slug } : { kind, slug, id: '' }
        if (!(await canEdit(req, probe)))
          return Response.json({ error: 'Forbidden' }, { status: 403 })
        const all = fieldsFor(cfg, kind)
        const editable = entry.options.fields ?? all.map((f) => f.name)
        const localization = req.payload.config.localization
        const labels = (cfg as CollectionConfig).labels
        const label = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback)
        const body: DocumentSchema = {
          kind,
          slug,
          labels: {
            singular: label(labels?.singular ?? (cfg as GlobalConfig).label, slug),
            plural: label(labels?.plural ?? (cfg as GlobalConfig).label, slug),
          },
          editable,
          fields: all.filter((f) => editable.includes(f.name)),
          drafts: Boolean(cfg.versions && typeof cfg.versions === 'object' && cfg.versions.drafts),
          ...(kind === 'collection' && (cfg as CollectionConfig).admin?.useAsTitle
            ? { useAsTitle: (cfg as CollectionConfig).admin!.useAsTitle }
            : {}),
          ...(localization
            ? {
                defaultLocale: localization.defaultLocale,
                locales: localization.locales.map((l) => (typeof l === 'string' ? l : l.code)),
              }
            : {}),
        }
        return Response.json(body, { headers: { 'Cache-Control': 'private, no-store' } })
      },
    }

    // Relationship search: titles of documents the signed-in user can read.
    const searchEndpoint: Endpoint = {
      path: `${prefix}/search/:slug`,
      method: 'get',
      handler: async (req) => {
        if (!req.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const slug = String(req.routeParams?.slug ?? '')
        const cfg = req.payload.collections[slug]?.config
        if (!cfg) return Response.json({ error: 'Unknown collection' }, { status: 404 })
        const q = params(req)
        const query = (q.get('q') ?? '').trim()
        const locale = q.get('locale') ?? undefined
        const limit = Math.min(Math.max(Number(q.get('limit')) || 10, 1), 25)
        const titleField = cfg.admin?.useAsTitle ?? 'id'
        const where = query
          ? titleField === 'id'
            ? { id: { equals: query } }
            : { [titleField]: { like: query } }
          : undefined
        const res = await req.payload.find({
          collection: slug as never,
          where: where as never,
          limit,
          depth: 1,
          overrideAccess: false,
          user: req.user,
          ...(locale ? { locale: locale as never } : {}),
        })
        const docs = res.docs.map((d) => {
          const doc = d as Record<string, unknown>
          const title = doc[titleField]
          return {
            id: doc.id,
            title: typeof title === 'string' && title ? title : String(doc.id),
            doc,
          }
        })
        return Response.json({ docs }, { headers: { 'Cache-Control': 'private, no-store' } })
      },
    }

    // Switch the current page between editing and previewing (signed-in editors only; never for link viewers).
    const modeEndpoint: Endpoint = {
      path: `${prefix}/mode`,
      method: 'get',
      handler: async (req) => {
        if (!req.user) return text('Sign in to the admin first', 401)
        const q = params(req)
        const mode: OnPageMode = q.get('mode') === 'view' ? 'view' : 'edit'
        const back = q.get('path')
        await requireSession().enable(mode, { secure: isSecure(req) })
        return Response.redirect(new URL(isSafePath(back) ? back : '/', originOf(req)), 307)
      },
    }

    const requireSession = (): SessionAdapter => {
      if (!options.session)
        throw new Error(
          'payload-onpage: pass `session` (e.g. nextSession()) to use enter/exit/preview endpoints',
        )
      return options.session
    }

    const enterEndpoint: Endpoint = {
      path: `${prefix}/enter`,
      method: 'get',
      handler: async (req) => {
        const q = params(req)
        const ref = readRef(q)
        const mode: OnPageMode = q.get('mode') === 'view' ? 'view' : 'edit'
        const locale = q.get('locale') ?? undefined
        if (!ref) return text('kind, slug and id are required', 400)
        if (!req.user) return text('Sign in to the admin first', 401)
        if (!(await canEdit(req, ref))) return text('You cannot edit this document', 403)
        const wanted = q.get('path')
        const path = isSafePath(wanted) ? wanted : await resolvePath(req, ref, locale)
        if (!path) return text('This document has no page to open', 404)
        await requireSession().enable(mode, { secure: isSecure(req) })
        return Response.redirect(new URL(path, originOf(req)), 307)
      },
    }

    const exitEndpoint: Endpoint = {
      path: `${prefix}/exit`,
      method: 'get',
      handler: async (req) => {
        const back = params(req).get('path')
        await requireSession().disable({ path: isSafePath(back) ? back! : undefined })
        return Response.redirect(new URL(isSafePath(back) ? back : '/', originOf(req)), 307)
      },
    }

    const previewLinkEndpoint: Endpoint = {
      path: `${prefix}/preview-link`,
      method: 'post',
      handler: async (req) => {
        const body = ((await req.json?.().catch(() => null)) ?? {}) as Record<string, unknown>
        const ref: DocRef | null =
          body.kind === 'global' && typeof body.slug === 'string'
            ? { kind: 'global', slug: body.slug }
            : typeof body.slug === 'string' &&
                (typeof body.id === 'string' || typeof body.id === 'number')
              ? { kind: 'collection', slug: body.slug, id: body.id }
              : null
        if (!ref) return Response.json({ error: 'kind, slug and id are required' }, { status: 400 })
        if (!(await canEdit(req, ref)))
          return Response.json({ error: 'Forbidden' }, { status: 403 })
        const locale = typeof body.locale === 'string' ? body.locale : undefined
        const path = isSafePath(body.path)
          ? (body.path as string)
          : await resolvePath(req, ref, locale)
        if (!path) return Response.json({ error: 'This document has no page' }, { status: 404 })
        const ttl = options.previewLinkTTL ?? 7 * 24 * 3600
        const token = createPreviewToken(
          { ref: refKey(ref), path, locale },
          req.payload.secret,
          ttl,
        )
        return Response.json({
          url: `${originOf(req)}${apiRoute}${prefix}/preview?token=${encodeURIComponent(token)}`,
          expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
        })
      },
    }

    const previewEndpoint: Endpoint = {
      path: `${prefix}/preview`,
      method: 'get',
      handler: async (req) => {
        const payload = verifyPreviewToken(params(req).get('token') ?? '', req.payload.secret)
        if (!payload || !parseRefKey(payload.ref))
          return text('This preview link is invalid or has expired.', 403)
        await requireSession().enable('view', { secure: isSecure(req), path: payload.path })
        return Response.redirect(new URL(payload.path, originOf(req)), 307)
      },
    }

    // ── hooks: markers on marked reads, never on writes ─────────────────────
    const clean = ({ data }: { data?: unknown }) => (data ? stegaCleanDeep(data) : data)

    const withHooks = <T extends CollectionConfig | GlobalConfig>(
      cfg: T,
      kind: Entry['kind'],
      entry: Entry,
    ): T => {
      const only = entry.options.fields
      const afterRead = ({
        doc,
        req,
        context,
      }: {
        doc: Record<string, unknown>
        req: PayloadRequest
        context: unknown
      }) => {
        if (!wantsMarkers(context) || req.locale === 'all') return doc
        const ref =
          kind === 'global'
            ? refKey({ kind, slug: cfg.slug })
            : doc?.id != null
              ? refKey({ kind, slug: cfg.slug, id: doc.id as string | number })
              : null
        return ref
          ? encodeDocument(doc, fieldsFor(cfg, kind), ref, { only, filter: options.encode })
          : doc
      }
      const hooks = { ...(cfg.hooks ?? {}) } as Record<string, unknown[]>
      hooks.beforeValidate = [...(hooks.beforeValidate ?? []), clean]
      hooks.beforeChange = [...(hooks.beforeChange ?? []), clean]
      hooks.afterRead = [...(hooks.afterRead ?? []), afterRead]
      return { ...cfg, hooks } as T
    }

    const adminControl = (kind: Entry['kind'], slug: string) => ({
      path: '@payload-onpage/plugin/admin#OnPageAdminControls',
      clientProps: { kind, slug, apiRoute, prefix },
    })

    const withAdmin = (c: CollectionConfig): CollectionConfig => {
      const edit = c.admin?.components?.edit ?? {}
      const existing = edit.beforeDocumentControls ?? []
      return {
        ...c,
        admin: {
          ...c.admin,
          components: {
            ...c.admin?.components,
            edit: {
              ...edit,
              beforeDocumentControls: [...existing, adminControl('collection', c.slug)],
            },
          },
        },
      }
    }
    const withGlobalAdmin = (g: GlobalConfig): GlobalConfig => {
      const elements = (g.admin?.components?.elements ?? {}) as {
        beforeDocumentControls?: unknown[]
      }
      return {
        ...g,
        admin: {
          ...g.admin,
          components: {
            ...g.admin?.components,
            elements: {
              ...elements,
              beforeDocumentControls: [
                ...(elements.beforeDocumentControls ?? []),
                adminControl('global', g.slug),
              ],
            } as never,
          },
        },
      }
    }

    const endpoints = [
      schemaEndpoint,
      enterEndpoint,
      exitEndpoint,
      modeEndpoint,
      searchEndpoint,
      previewLinkEndpoint,
      previewEndpoint,
    ]
    const ours = new Set(endpoints.map((e) => e.path))
    return {
      ...incoming,
      collections: (incoming.collections ?? []).map((c) => {
        const entry = byKey.get(`collection:${c.slug}`)
        return entry ? withAdmin(withHooks(c, 'collection', entry)) : c
      }),
      globals: (incoming.globals ?? []).map((g) => {
        const entry = byKey.get(`global:${g.slug}`)
        return entry ? withGlobalAdmin(withHooks(g, 'global', entry)) : g
      }),
      endpoints: [...(incoming.endpoints ?? []).filter((e) => !ours.has(e.path)), ...endpoints],
    }
  }
}

export { encodeDocument, MACHINE_FIELD_NAME } from '@payload-onpage/core'
export type { EncodeFilter } from '@payload-onpage/core'
export { createPreviewToken, verifyPreviewToken } from './tokens.ts'
export type { PreviewTokenPayload } from './tokens.ts'
export type { Payload }
