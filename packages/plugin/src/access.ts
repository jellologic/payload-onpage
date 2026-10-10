/**
 * Who may use on-page editing, and edit which documents. Document access is
 * evaluated by Payload itself (`docAccessOperation`), so row-level rules
 * (access functions that return a query) and field permissions behave exactly
 * as in the admin.
 */
import type { DocRef } from '@payload-onpage/core'
import {
  docAccessOperation,
  docAccessOperationGlobal,
  type PayloadRequest,
  type SanitizedCollectionPermission,
  type SanitizedGlobalPermission,
} from 'payload'
import type { OnPageOptions } from './options.ts'

/** Signed in as an admin user (or allowed by the `access` option). */
export async function canUseOnPage(req: PayloadRequest, options: OnPageOptions): Promise<boolean> {
  if (!req.user) return false
  if (options.access) return Boolean(await options.access({ req }))
  return req.user.collection === req.payload.config.admin.user
}

/** Payload's sanitized permissions for one document (or the collection, without an id). */
export async function documentPermissions(
  req: PayloadRequest,
  ref: DocRef | { kind: 'collection'; slug: string; id?: undefined },
): Promise<SanitizedCollectionPermission | SanitizedGlobalPermission | null> {
  try {
    if (ref.kind === 'global') {
      const globalConfig = req.payload.globals.config.find((g) => g.slug === ref.slug)
      return globalConfig ? await docAccessOperationGlobal({ globalConfig, req }) : null
    }
    const collection = req.payload.collections[ref.slug]
    if (!collection) return null
    return await docAccessOperation({ collection, id: ref.id, req })
  } catch {
    return null
  }
}

/** May this user edit this document on the page? */
export async function canEditDocument(
  req: PayloadRequest,
  ref: DocRef,
  options: OnPageOptions,
): Promise<boolean> {
  if (!req.user) return false
  if (options.access) return Boolean(await options.access({ req, ref }))
  if (!(await canUseOnPage(req, options))) return false
  const perms = await documentPermissions(req, ref)
  const update = perms?.update as
    true | { permission?: boolean; where?: Record<string, unknown> } | undefined
  if (update === true) return true
  if (!update?.permission) return false
  // A row-level rule comes back as a query: check that this document matches it.
  if (!update.where || ref.kind !== 'collection') return !update.where
  const { totalDocs } = await req.payload.count({
    collection: ref.slug as never,
    where: { and: [{ id: { equals: ref.id } }, update.where] } as never,
    overrideAccess: true,
    req,
  })
  return totalDocs > 0
}
