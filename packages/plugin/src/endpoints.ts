/**
 * The plugin's endpoints, under `${api}${routePrefix}` (default /api/onpage):
 *
 *   GET  /schema/:kind/:slug   editable field schema for the signed-in editor (JSON)
 *   POST /enter                start editing or previewing a document's page
 *   POST /mode                 switch the current page between editing and previewing
 *   POST /exit                 leave edit/preview mode
 *   POST /preview-link         create a sealed, expiring read-only link (JSON)
 *   GET  /preview?token=       open a preview link
 *
 * JSON endpoints throw Payload's errors, so responses, logging, CORS and
 * translations match Payload's own. The form/new-tab endpoints answer in plain
 * text or redirect. State-changing endpoints are same-origin POSTs (CSRF-safe),
 * and every authorization decision goes through ./access (Payload's access rules).
 */
import {
  isOnPageMode,
  modeSealer,
  parseRefKey,
  pathnameOf,
  refKey,
  ROUTES,
  safePath,
  samePath,
  SEAL_PURPOSE,
  seal,
  type DocRef,
  type DocumentSchema,
  type PreviewGrant,
  type SessionAdapter,
} from '@payload-onpage/core'
import {
  addDataAndFileToRequest,
  APIError,
  Forbidden,
  NotFound,
  type Endpoint,
  type PayloadRequest,
  type TypedLocale,
} from 'payload'
import { getAutosaveInterval, hasAutosaveEnabled, hasDraftsEnabled, toWords } from 'payload/shared'
import { canEditDocument, canUseOnPage, documentPermissions, isUpdateDenied } from './access.ts'
import {
  apiURL,
  entityConfig,
  isSecure,
  json,
  readRef,
  redirectTo,
  rejectCrossSite,
  text,
  withIdType,
} from './http.ts'
import type { Entry, OnPageOptions } from './options.ts'
import { resolvePath } from './paths.ts'
import { label, relationTargets, serializeFields } from './schema.ts'
import { createPreviewToken, verifyPreviewToken } from './tokens.ts'

export interface EndpointContext {
  options: OnPageOptions & { session: SessionAdapter }
  prefix: `/${string}`
  entry: (kind: DocRef['kind'], slug: string) => Entry | undefined
  entries: Entry[]
}

const DAY = 24 * 3600

const secretOf = (req: PayloadRequest, options: OnPageOptions): string =>
  options.secret ?? req.payload.config.secret

/** Name of the auth cookie an editor's mode is bound to. */
const authCookieOf = (req: PayloadRequest, options: OnPageOptions): string =>
  options.authCookie ?? `${req.payload.config.cookiePrefix || 'payload'}-token`

/** A locale value from a body, if it's one Payload knows. */
const knownLocale = (req: PayloadRequest, value: unknown): TypedLocale | undefined =>
  typeof value === 'string' && req.payload.config.localization
    ? req.payload.config.localization.localeCodes.find((c) => c === value)
    : undefined

export function createEndpoints(ctx: EndpointContext): Endpoint[] {
  const { options, prefix } = ctx
  const { session } = options

  /** True when the user may update at least one enabled document (row-level rules count). */
  const canEditAnything = async (req: PayloadRequest): Promise<boolean> => {
    const checks = await Promise.all(
      ctx.entries.map((e) => documentPermissions(req, { kind: e.kind, slug: e.slug })),
    )
    return checks.some((perms) => !isUpdateDenied(perms))
  }

  const schema: Endpoint = {
    path: `${prefix}${ROUTES.schema}/:kind/:slug`,
    method: 'get',
    handler: async (req) => {
      const kind = req.routeParams?.kind === 'global' ? 'global' : 'collection'
      const slug = typeof req.routeParams?.slug === 'string' ? req.routeParams.slug : ''
      const entry = ctx.entry(kind, slug)
      const cfg = entityConfig(req, kind, slug)
      if (!entry || !cfg) throw new NotFound(req.t)
      if (!(await canUseOnPage(req, options))) throw new Forbidden(req.t)

      const perms = await documentPermissions(req, { kind, slug })
      if (isUpdateDenied(perms)) throw new Forbidden(req.t)
      const pending: Promise<void>[] = []
      const all = serializeFields(cfg.fields, {
        i18n: req.i18n,
        blocks: req.payload.config.blocks,
        permissions: perms?.fields,
        defaults: { req, pending },
      })
      await Promise.all(pending)
      const only = entry.options.fields
      const fields = only ? all.filter((f) => only.includes(f.name)) : all

      const i18n = { i18n: req.i18n }
      const relations: NonNullable<DocumentSchema['relations']> = {}
      for (const target of relationTargets(fields)) {
        const c = entityConfig(req, 'collection', target)
        if (c)
          relations[target] = {
            titleField: c.admin?.useAsTitle ?? 'id',
            label: label(c.labels?.singular, toWords(target), i18n),
          }
      }
      const labels =
        'labels' in cfg
          ? {
              singular: label(cfg.labels?.singular, toWords(slug), i18n),
              plural: label(cfg.labels?.plural, toWords(slug), i18n),
            }
          : {
              singular: label(cfg.label, toWords(slug), i18n),
              plural: label(cfg.label, toWords(slug), i18n),
            }
      const useAsTitle = 'labels' in cfg ? cfg.admin?.useAsTitle : undefined
      const localization = req.payload.config.localization
      const body: DocumentSchema = {
        kind,
        slug,
        labels,
        editable: fields.map((f) => f.name),
        fields,
        drafts: hasDraftsEnabled(cfg),
        ...(hasAutosaveEnabled(cfg) ? { autosaveInterval: getAutosaveInterval(cfg) } : {}),
        ...(useAsTitle ? { useAsTitle } : {}),
        ...(Object.keys(relations).length ? { relations } : {}),
        ...(localization
          ? { defaultLocale: localization.defaultLocale, locales: localization.localeCodes }
          : {}),
      }
      return json(body)
    },
  }

  const enter: Endpoint = {
    path: `${prefix}${ROUTES.enter}`,
    method: 'post',
    handler: async (req) => {
      const refused = rejectCrossSite(req)
      if (refused) return refused
      // Authenticate before parsing the ref, so anonymous callers can't probe
      // which slugs are enabled by the status code.
      if (!req.user) return text('Sign in to the admin first', 401)
      if (!(await canUseOnPage(req, options))) return text('You cannot use on-page editing', 403)
      const q = req.searchParams
      const ref = readRef(req, { kind: q.get('kind'), slug: q.get('slug'), id: q.get('id') })
      const entry = ref && ctx.entry(ref.kind, ref.slug)
      if (!ref || !entry) return text('Unknown document', 400)
      if (!(await canEditDocument(req, ref, options)))
        return text('You cannot edit this document', 403)
      const locale = req.locale && req.locale !== 'all' ? req.locale : undefined
      const path = safePath(q.get('path')) ?? (await resolvePath(req, ref, entry, locale))
      if (!path) return text('This document has no page to open', 404)
      const mode = q.get('mode')
      await session.enable(isOnPageMode(mode) ? mode : 'edit', {
        secure: isSecure(req),
        bindTo: authCookieOf(req, options),
        sealMode: modeSealer(secretOf(req, options)),
      })
      return redirectTo(req, path)
    },
  }

  const mode: Endpoint = {
    path: `${prefix}${ROUTES.mode}`,
    method: 'post',
    handler: async (req) => {
      const refused = rejectCrossSite(req)
      if (refused) return refused
      if (!req.user) return text('Sign in to the admin first', 401)
      if (!(await canUseOnPage(req, options))) return text('You cannot use on-page editing', 403)
      if (!(await canEditAnything(req))) return text('You cannot edit any document', 403)
      const q = req.searchParams
      const next = q.get('mode')
      await session.enable(isOnPageMode(next) ? next : 'edit', {
        secure: isSecure(req),
        bindTo: authCookieOf(req, options),
        sealMode: modeSealer(secretOf(req, options)),
      })
      return redirectTo(req, q.get('path'))
    },
  }

  const exit: Endpoint = {
    path: `${prefix}${ROUTES.exit}`,
    method: 'post',
    handler: async (req) => {
      const refused = rejectCrossSite(req)
      if (refused) return refused
      const path = safePath(req.searchParams.get('path'))
      await session.disable(path ? { path: pathnameOf(path) } : undefined)
      return redirectTo(req, path)
    },
  }

  const previewLink: Endpoint = {
    path: `${prefix}${ROUTES.previewLink}`,
    method: 'post',
    handler: async (req) => {
      const refused = rejectCrossSite(req)
      if (refused) return refused
      if (!req.headers.get('content-type')?.includes('application/json'))
        throw new APIError('Expected a JSON body', 415)
      await addDataAndFileToRequest(req) // parses JSON, or throws a 400
      // Authenticate before parsing the ref, so anonymous callers can't probe
      // which slugs are enabled by the status code.
      if (!(await canUseOnPage(req, options))) throw new Forbidden(req.t)
      const body: Record<string, unknown> = req.data ?? {}
      const ref = readRef(req, body)
      const entry = ref && ctx.entry(ref.kind, ref.slug)
      if (!ref || !entry) throw new APIError('Unknown document', 400)
      if (!(await canEditDocument(req, ref, options))) throw new Forbidden(req.t)
      const locale = knownLocale(req, body.locale)
      // The path is always derived on the server: a link opens this document's page and nothing else.
      const path = await resolvePath(req, ref, entry, locale)
      if (!path) throw new APIError('This document has no page', 404)
      const { token, payload } = await createPreviewToken(
        { ref: refKey(ref), path, ...(locale ? { locale } : {}) },
        secretOf(req, options),
        options.previewLinkTTL ?? DAY,
      )
      return json({
        url: `${apiURL(req, `${prefix}${ROUTES.preview}`)}?token=${encodeURIComponent(token)}`,
        expiresAt: new Date(payload.exp * 1000).toISOString(),
        id: payload.jti,
      })
    },
  }

  const preview: Endpoint = {
    path: `${prefix}${ROUTES.preview}`,
    method: 'get',
    handler: async (req) => {
      const invalid = () => text('This preview link is invalid or has expired.', 403)
      const secret = secretOf(req, options)
      const token = await verifyPreviewToken(req.searchParams.get('token') ?? '', secret)
      const parsed = token && parseRefKey(token.ref)
      const ref = parsed && withIdType(req, parsed)
      const entry = ref && ctx.entry(ref.kind, ref.slug)
      if (!token || !ref || !entry) return invalid()
      // Still the document's page? (It may have been deleted, or its slug changed.)
      const current = await resolvePath(req, ref, entry, knownLocale(req, token.locale))
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
      await session.enableLink({
        secure: isSecure(req),
        path: pathnameOf(token.path),
        expiresAt: new Date(token.exp * 1000),
        seal: (draftSecret) => {
          const grant: PreviewGrant = {
            path: pathnameOf(token.path),
            ref: token.ref,
            exp: token.exp,
            draft: draftSecret,
          }
          return seal(grant, secret, SEAL_PURPOSE.previewCookie)
        },
      })
      return redirectTo(req, token.path, 307)
    },
  }

  return [schema, enter, mode, exit, previewLink, preview]
}
