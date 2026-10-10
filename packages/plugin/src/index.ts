/**
 * @payload-onpage/plugin — the Payload side of payload-onpage.
 *
 *   plugins: [onpage({ collections: ['pages'], globals: ['header'], session: nextSession() })]
 *
 * Adds the endpoints in ./endpoints, auto-mapping on reads that ask for it,
 * marker stripping and a stale-write guard on every write, and "Edit on page" /
 * "Copy preview link" controls in the admin. Saves from the editor go through
 * Payload's REST API, so access control, hooks, validation, drafts and versions
 * apply unchanged.
 */
import { DEFAULTS, type SchemaField } from '@payload-onpage/core'
import type { CollectionConfig, Config, GlobalConfig, Plugin } from 'payload'
import { createEndpoints } from './endpoints.ts'
import { encodeOnRead, guardStaleWrite, stripMarkers } from './hooks.ts'
import { normalizeEntries, type Entry, type OnPageOptions } from './options.ts'
import { serializeFields } from './schema.ts'
import { translations } from './translations.ts'

const APPLIED = 'payload-onpage'

type Translations = Record<string, Record<string, unknown>>
/** Ours first; the site's own translations (any language, any key) win. */
function mergeTranslations(
  ours: Translations,
  theirs: unknown,
): NonNullable<Config['i18n']>['translations'] {
  const out: Translations = { ...ours }
  for (const [lang, table] of Object.entries((theirs ?? {}) as Translations)) {
    const mine = out[lang] ?? {}
    out[lang] = {
      ...mine,
      ...table,
      onpage: { ...(mine.onpage as object), ...(table.onpage ?? {}) },
    }
  }
  return out
}

export function onpage(options: OnPageOptions): Plugin {
  return (incoming: Config): Config => {
    if (options.enabled === false || incoming.custom?.[APPLIED]) return incoming
    const prefix = options.routePrefix ?? DEFAULTS.routePrefix
    const apiRoute = incoming.routes?.api ?? DEFAULTS.apiRoute
    const entries = [
      ...normalizeEntries(options.collections, 'collection'),
      ...normalizeEntries(options.globals, 'global'),
    ]
    const byKey = new Map(entries.map((e) => [`${e.kind}:${e.slug}`, e]))

    const withHooks = <T extends CollectionConfig | GlobalConfig>(cfg: T, entry: Entry): T => {
      let fields: SchemaField[] | undefined
      // Encoding only needs names, types and editors: serialize once, lazily, without request context.
      const lazyFields = () => (fields ??= serializeFields(cfg.fields, { blocks: incoming.blocks }))
      const hooks = { ...(cfg.hooks ?? {}) } as Record<string, unknown[]>
      hooks.beforeValidate = [...(hooks.beforeValidate ?? []), stripMarkers]
      hooks.beforeChange = [...(hooks.beforeChange ?? []), stripMarkers, guardStaleWrite]
      hooks.afterRead = [
        ...(hooks.afterRead ?? []),
        encodeOnRead({
          kind: entry.kind,
          slug: cfg.slug,
          fields: lazyFields,
          only: entry.options.fields,
          filter: options.encode,
        }),
      ]
      return { ...cfg, hooks }
    }

    const control = (kind: Entry['kind'], slug: string) => ({
      path: '@payload-onpage/plugin/admin#OnPageAdminControls',
      clientProps: { kind, slug, prefix },
    })

    const withCollectionAdmin = (c: CollectionConfig): CollectionConfig => {
      const edit = c.admin?.components?.edit ?? {}
      return {
        ...c,
        admin: {
          ...c.admin,
          components: {
            ...c.admin?.components,
            edit: {
              ...edit,
              beforeDocumentControls: [
                ...(edit.beforeDocumentControls ?? []),
                control('collection', c.slug),
              ],
            },
          },
        },
      }
    }
    const withGlobalAdmin = (g: GlobalConfig): GlobalConfig => {
      const elements = g.admin?.components?.elements ?? {}
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
                control('global', g.slug),
              ],
            },
          },
        },
      }
    }

    const missing = entries.filter((e) =>
      e.kind === 'global'
        ? !incoming.globals?.some((g) => g.slug === e.slug)
        : !incoming.collections?.some((c) => c.slug === e.slug),
    )
    if (missing.length) {
      throw new Error(
        `payload-onpage: unknown ${missing.map((e) => `${e.kind} "${e.slug}"`).join(', ')}`,
      )
    }

    return {
      ...incoming,
      custom: { ...incoming.custom, [APPLIED]: true },
      i18n: {
        ...incoming.i18n,
        translations: mergeTranslations(translations, incoming.i18n?.translations),
      },
      collections: (incoming.collections ?? []).map((c) => {
        const entry = byKey.get(`collection:${c.slug}`)
        return entry ? withCollectionAdmin(withHooks(c, entry)) : c
      }),
      globals: (incoming.globals ?? []).map((g) => {
        const entry = byKey.get(`global:${g.slug}`)
        return entry ? withGlobalAdmin(withHooks(g, entry)) : g
      }),
      endpoints: [
        ...(incoming.endpoints ?? []),
        ...createEndpoints({
          options,
          prefix,
          apiRoute,
          entry: (kind, slug) => byKey.get(`${kind}:${slug}`),
        }),
      ],
      onInit: async (payload) => {
        if (process.env.NODE_ENV === 'production' && !payload.config.serverURL) {
          payload.logger.warn(
            'payload-onpage: set `serverURL` in production so redirects, preview links and Secure cookies use the public origin.',
          )
        }
        await incoming.onInit?.(payload)
      },
    }
  }
}

export type { OnPageDocOptions, OnPageOptions } from './options.ts'
export { canEditDocument, canUseOnPage } from './access.ts'
export { createPreviewToken, verifyPreviewToken, type PreviewTokenPayload } from './tokens.ts'
export { serializeFields, type SerializeContext } from './schema.ts'
export { wantsMarkers } from './hooks.ts'
export { translations } from './translations.ts'
