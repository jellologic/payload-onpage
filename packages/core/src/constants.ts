/** Defaults shared by every package, so routes and names are defined once. */
export const DEFAULTS = {
  apiRoute: '/api',
  routePrefix: '/onpage',
  adminRoute: '/admin',
} as const

/** Cookies and headers used by the Next.js adapter and its proxy. */
export const COOKIE = {
  /** Editor mode, bound to the signed-in session: `edit|view:<authCookie>:<hash>`. */
  mode: 'onpage',
  /** Sealed preview-link grant (path, expiry, Next's draft secret); only the proxy can read it. */
  preview: 'onpage_preview',
  /** Next.js's draft-mode cookie. */
  nextDraft: '__prerender_bypass',
} as const

export const HEADER = {
  /** Request path, set by the proxy (server components can't see it otherwise). */
  path: 'x-onpage-path',
  /** Set by the proxy when this request is a preview-link view. */
  shared: 'x-onpage-shared',
  /** Stale-write guard: the `updatedAt` the editor last saw. */
  ifUnmodifiedSince: 'x-onpage-if-unmodified-since',
} as const
