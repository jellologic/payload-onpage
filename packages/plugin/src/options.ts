import type { DocRef, EncodeFilter, SessionAdapter } from '@payload-onpage/core'
import type { PayloadRequest } from 'payload'

export interface OnPageDocOptions {
  /** Top-level fields editable on the page. Default: every top-level field the user may update. */
  fields?: string[]
  /**
   * The site path that shows this document. Default for collections: the
   * collection's `admin.preview` URL, else `/${doc.slug}`. Globals: "/".
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
  /**
   * Who may use on-page editing (`ref` undefined) and edit a given document.
   * Default: users of the admin user collection, with the document's own
   * `update` access (evaluated by Payload, including row-level rules).
   */
  access?: (args: { req: PayloadRequest; ref?: DocRef }) => boolean | Promise<boolean>
  /** Framework adapter that switches edit/preview mode (e.g. `nextSession()`). Required for the enter/exit/preview endpoints. */
  session?: SessionAdapter
  /** Narrow which strings get auto-mapping markers. */
  encode?: EncodeFilter
  /** Lifetime of shareable preview links, in seconds. Default 1 day. */
  previewLinkTTL?: number
  /** Extra check when a preview link is opened (e.g. a revocation list). Return false to refuse it. */
  validatePreviewLink?: (args: {
    req: PayloadRequest
    ref: DocRef
    path: string
    issuedAt: number
    id: string
  }) => boolean | Promise<boolean>
  /**
   * Secret for preview links and the preview cookie. Default: Payload's `secret`
   * (`PAYLOAD_SECRET`). The Next.js proxy must be given the same value.
   */
  secret?: string
  /** Auth cookie an editor's session is bound to. Default `${cookiePrefix}-token` ("payload-token"). */
  authCookie?: string
  /** Endpoint prefix under the API route. Default "/onpage". */
  routePrefix?: string
  enabled?: boolean
}

export interface Entry {
  kind: 'collection' | 'global'
  slug: string
  options: OnPageDocOptions
}

export const normalizeEntries = (
  input: OnPageOptions['collections'],
  kind: Entry['kind'],
): Entry[] =>
  Array.isArray(input)
    ? input.map((slug) => ({ kind, slug, options: {} }))
    : Object.entries(input ?? {}).map(([slug, o]) => ({ kind, slug, options: o === true ? {} : o }))
