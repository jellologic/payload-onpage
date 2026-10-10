/**
 * The plugin's endpoints, under `${api}${routePrefix}` (default /api/onpage):
 *
 *   GET  /schema/:kind/:slug   editable field schema for the signed-in editor
 *   POST /enter                start editing or previewing a document's page
 *   POST /mode                 switch the current page between editing and previewing
 *   POST /exit                 leave edit/preview mode
 *   POST /preview-link         create a sealed, expiring read-only link (JSON)
 *   GET  /preview?token=       open a preview link
 *
 * State-changing endpoints are same-origin POSTs (CSRF-safe). Every
 * authorization decision goes through ./access (Payload's own access rules).
 */
import {
  parseRefKey,
  pathnameOf,
  refKey,
  safePath,
  samePath,
  SEAL_PURPOSE,
  seal,
  type DocumentSchema,
  type OnPageMode,
  type SessionAdapter,
} from '@payload-onpage/core'
import type { CollectionConfig, Endpoint, GlobalConfig, PayloadRequest } from 'payload'
import { hasAutosaveEnabled, hasDraftsEnabled, getAutosaveInterval } from 'payload/shared'
import { canEditDocument, canUseOnPage, documentPermissions } from './access.ts'
import {
  isSecure,
  json,
  originOf,
  queryOf,
  readRef,
  redirectTo,
  rejectCrossSite,
  text,
} from './http.ts'
import type { Entry, OnPageOptions } from './options.ts'
import { resolvePath } from './paths.ts'
import { relationTargets, serializeFields } from './schema.ts'
import { createPreviewToken, verifyPreviewToken } from './tokens.ts'

export interface EndpointContext {
  options: OnPageOptions
  prefix: string
  apiRoute: string
  entry: (kind: string, slug: string) => Entry | undefined
}

const DAY = 24 * 3600

export const secretOf = (req: PayloadRequest, options: OnPageOptions): string =>
  options.secret ?? req.payload.config.secret

/** Name of the auth cookie an editor's mode is bound to. */
const authCookieOf = (req: PayloadRequest, options: OnPageOptions): string =>
  options.authCookie ?? `${req.payload.config.cookiePrefix || 'payload'}-token`

function requireSession(options: OnPageOptions): SessionAdapter {
  if (!options.session)
    throw new Error(
      'payload-onpage: pass `session` (e.g. nextSession()) to use the enter, mode, exit and preview endpoints',
    )
  return options.session
}

export function createEndpoints(ctx: EndpointContext): Endpoint[] {
  const { options, prefix, apiRoute } = ctx

  const schema: Endpoint = {
    path: `${prefix}/schema/:kind/:slug`,
    method: 'get',
    handler: async (req) => {
      const kind = req.routeParams?.kind === 'global' ? 'global' : 'collection'
      const slug = String(req.routeParams?.slug ?? '')
      const entry = ctx.entry(kind, slug)
      const cfg: CollectionConfig | GlobalConfig | undefined =
        kind === 'global'
          ? req.payload.globals.config.find((g) => g.slug === slug)
          : req.payload.collections[slug]?.config
      if (!entry || !cfg) return json({ error: 'Not enabled for on-page editing' }, 404)
      if (!(await canUseOnPage(req, options))) return json({ error: 'Forbidden' }, 403)

      const perms = await documentPermissions(
        req,
        kind === 'global' ? { kind, slug } : { kind, slug },
      )
      const pending: Promise<void>[] = []
      const all = serializeFields(cfg.fields, {
        i18n: req.i18n,
        blocks: req.payload.config.blocks,
        permissions: perms?.fields,
        defaults: { req, pending },
      })
      await Promise.all(pending)
      const fields = entry.options.fields
        ? all.filter((f) => entry.options.fields!.includes(f.name))
        : all

      const relations: NonNullable<DocumentSchema['relations']> = {}
      for (const target of relationTargets(fields)) {
        const c = req.payload.collections[target]?.config
        if (!c) continue
        relations[target] = {
          titleField: c.admin?.useAsTitle ?? 'id',
          label: typeof c.labels?.singular === 'string' ? c.labels.singular : target,
        }
      }
      const localization = req.payload.config.localization
      const labelOf = (v: unknown) => (typeof v === 'string' ? v : slug)
      const body: DocumentSchema = {
        kind,
        slug,
        labels:
          kind === 'global'
            ? {
                singular: labelOf((cfg as GlobalConfig).label),
                plural: labelOf((cfg as GlobalConfig).label),
              }
            : {
                singular: labelOf((cfg as CollectionConfig).labels?.singular),
                plural: labelOf((cfg as CollectionConfig).labels?.plural),
              },
        editable: fields.map((f) => f.name),
        fields,
        drafts: hasDraftsEnabled(cfg),
        ...(hasAutosaveEnabled(cfg) ? { autosaveInterval: getAutosaveInterval(cfg) } : {}),
        ...(kind === 'collection' && (cfg as CollectionConfig).admin?.useAsTitle
          ? { useAsTitle: (cfg as CollectionConfig).admin!.useAsTitle }
          : {}),
        ...(Object.keys(relations).length ? { relations } : {}),
        ...(localization
          ? {
              defaultLocale: localization.defaultLocale,
              locales: localization.locales.map((l) => (typeof l === 'string' ? l : l.code)),
            }
          : {}),
      }
      return json(body)
    },
  }

  const enter: Endpoint = {
    path: `${prefix}/enter`,
    method: 'post',
    handler: async (req) => {
      const refused = rejectCrossSite(req)
      if (refused) return refused
      const q = queryOf(req)
      const ref = readRef({ kind: q.get('kind'), slug: q.get('slug'), id: q.get('id') })
      const entry = ref && ctx.entry(ref.kind, ref.slug)
      if (!ref || !entry) return text('Unknown document', 400)
      if (!req.user) return text('Sign in to the admin first', 401)
      if (!(await canEditDocument(req, ref, options)))
        return text('You cannot edit this document', 403)
      const locale = q.get('locale') ?? undefined
      const path = safePath(q.get('path')) ?? (await resolvePath(req, ref, entry, locale))
      if (!path) return text('This document has no page to open', 404)
      const mode: OnPageMode = q.get('mode') === 'view' ? 'view' : 'edit'
      await requireSession(options).enable(mode, {
        secure: isSecure(req),
        bindTo: authCookieOf(req, options),
      })
      return redirectTo(req, path)
    },
  }

  const mode: Endpoint = {
    path: `${prefix}/mode`,
    method: 'post',
    handler: async (req) => {
      const refused = rejectCrossSite(req)
      if (refused) return refused
      if (!(await canUseOnPage(req, options))) return text('Sign in as an editor first', 401)
      const q = queryOf(req)
      await requireSession(options).enable(q.get('mode') === 'view' ? 'view' : 'edit', {
        secure: isSecure(req),
        bindTo: authCookieOf(req, options),
      })
      return redirectTo(req, q.get('path'))
    },
  }

  const exit: Endpoint = {
    path: `${prefix}/exit`,
    method: 'post',
    handler: async (req) => {
      const refused = rejectCrossSite(req)
      if (refused) return refused
      await requireSession(options).disable()
      return redirectTo(req, queryOf(req).get('path'))
    },
  }

  const previewLink: Endpoint = {
    path: `${prefix}/preview-link`,
    method: 'post',
    handler: async (req) => {
      const refused = rejectCrossSite(req)
      if (refused) return refused
      if (!req.headers.get('content-type')?.includes('application/json'))
        return json({ error: 'Expected JSON' }, 415)
      const body = ((await req.json?.().catch(() => null)) ?? {}) as Record<string, unknown>
      const ref = readRef(body)
      const entry = ref && ctx.entry(ref.kind, ref.slug)
      if (!ref || !entry) return json({ error: 'Unknown document' }, 400)
      if (!(await canEditDocument(req, ref, options))) return json({ error: 'Forbidden' }, 403)
      const locale = typeof body.locale === 'string' ? body.locale : undefined
      // The path is always derived on the server: a link opens this document's page and nothing else.
      const path = await resolvePath(req, ref, entry, locale)
      if (!path) return json({ error: 'This document has no page' }, 404)
      const ttl = options.previewLinkTTL ?? DAY
      const { token, payload } = await createPreviewToken(
        { ref: refKey(ref), path, locale },
        secretOf(req, options),
        ttl,
      )
      return json({
        url: `${originOf(req)}${apiRoute}${prefix}/preview?token=${encodeURIComponent(token)}`,
        expiresAt: new Date(payload.exp * 1000).toISOString(),
        id: payload.jti,
      })
    },
  }

  const preview: Endpoint = {
    path: `${prefix}/preview`,
    method: 'get',
    handler: async (req) => {
      const invalid = () => text('This preview link is invalid or has expired.', 403)
      const secret = secretOf(req, options)
      const token = await verifyPreviewToken(queryOf(req).get('token') ?? '', secret)
      const ref = token && parseRefKey(token.ref)
      const entry = ref && ctx.entry(ref.kind, ref.slug)
      if (!token || !ref || !entry) return invalid()
      // Still the document's page? (It may have been deleted, or its slug changed.)
      const current = await resolvePath(req, ref, entry, token.locale)
      if (!current || !samePath(current, token.path)) return invalid()
      if (
        options.validatePreviewLink &&
        !(await options.validatePreviewLink({
          req,
          ref,
          path: token.path,
          issuedAt: token.iat,
          id: token.jti,
        }))
      ) {
        return invalid()
      }
      const expiresAt = new Date(token.exp * 1000)
      await requireSession(options).enableLink({
        secure: isSecure(req),
        path: pathnameOf(token.path),
        expiresAt,
        seal: (draftSecret) =>
          seal(
            { path: pathnameOf(token.path), ref: token.ref, exp: token.exp, draft: draftSecret },
            secret,
            SEAL_PURPOSE.previewCookie,
          ),
      })
      return redirectTo(req, token.path, 307)
    },
  }

  return [schema, enter, mode, exit, previewLink, preview]
}
