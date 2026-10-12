/**
 * Next.js App Router session adapter and helpers.
 *
 * Editors: Next draft mode plus an `onpage` cookie saying which mode, bound to
 * a hash of their auth cookie, so signing out (or in as someone else) ends it.
 * The cookie is sealed with the plugin secret; the proxy verifies the seal and
 * strips forged ones, and these helpers check its shape and binding.
 *
 * Preview links: the browser gets a sealed grant (`onpage_preview`). The proxy
 * (./proxy) unseals it and injects draft mode into the request for the shared
 * page only. With `cdnBypass` (default on Vercel), the browser also gets Next's
 * draft cookie scoped to that page's path and the link's expiry: Vercel's cache
 * decides bypass from the browser's own cookies, before any proxy runs. The
 * proxy refuses that cookie everywhere the grant doesn't cover.
 *
 * All helpers read `draftMode().isEnabled` first and touch cookies only when
 * draft mode is on. Next exempts that read from prerender bailout, so pages
 * stay static for visitors.
 */
import {
  CONTEXT_KEY,
  COOKIE,
  createModeCookie,
  HEADER,
  readModeCookie,
  type OnPageMode,
  type SessionAdapter,
} from '@payload-onpage/core'
import { cookies, draftMode, headers } from 'next/headers.js'

export interface NextSessionOptions {
  /** How long an editor's edit/preview mode lasts, in seconds. Default 12 hours. */
  maxAge?: number
  /**
   * Give preview-link viewers Next's draft cookie, scoped to the shared page's
   * path and expiring with the link, so a CDN that serves cached pages unless
   * the browser itself sends the draft cookie (Vercel) shows them the draft.
   * Requires the proxy (`withOnPage`), which strips it on every other page.
   * Default: on when deployed on Vercel (`process.env.VERCEL`).
   */
  cdnBypass?: boolean
}

type Jar = Awaited<ReturnType<typeof cookies>>
type CookieOptions = NonNullable<Parameters<Jar['set']>[2]>

/** Our cookies: server-only, same-site, whole site. */
const cookieBase = (secure: boolean) =>
  ({ httpOnly: true, sameSite: 'lax', secure, path: '/' }) satisfies CookieOptions

/**
 * Runs `read` only in draft mode, so visitors' requests never touch cookies and
 * pages stay static. Outside a request (build, scripts) it returns `fallback`.
 */
async function inDraft<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return (await draftMode()).isEnabled ? await read() : fallback
  } catch {
    return fallback
  }
}

/** The cookie's mode, checking shape and binding; the proxy has verified its seal. */
async function readMode(raw: string | undefined, jar: Jar): Promise<OnPageMode | null> {
  return (await readModeCookie(raw, (name) => jar.get(name)?.value, null))?.mode ?? null
}

export function nextSession(opts: NextSessionOptions = {}): SessionAdapter {
  const maxAge = opts.maxAge ?? 12 * 3600
  const cdnBypass = opts.cdnBypass ?? (typeof process !== 'undefined' && !!process.env.VERCEL)
  return {
    async enable(mode, { secure, bindTo, sealMode }) {
      ;(await draftMode()).enable()
      const jar = await cookies()
      const value = await createModeCookie(mode, {
        sealMode,
        expiresAt: new Date(Date.now() + maxAge * 1000),
        bindTo,
        token: bindTo ? jar.get(bindTo)?.value : undefined,
      })
      jar.set(COOKIE.mode, value, { ...cookieBase(secure), maxAge })
      jar.delete(COOKIE.preview)
    },
    async enableLink({ secure, path, expiresAt, seal }) {
      ;(await draftMode()).enable()
      const jar = await cookies()
      const draft = jar.get(COOKIE.nextDraft)?.value
      if (!draft) throw new Error('payload-onpage: Next.js did not set its draft-mode cookie')
      if (cdnBypass) {
        // Replaces the site-wide cookie draftMode() just set: this page, this link's lifetime.
        jar.set(COOKIE.nextDraft, draft, { ...cookieBase(secure), path, expires: expiresAt })
      } else {
        // Keep the draft secret server-side: the browser only gets the sealed grant.
        jar.delete(COOKIE.nextDraft)
      }
      jar.delete(COOKIE.mode)
      jar.set(COOKIE.preview, await seal(draft), { ...cookieBase(secure), expires: expiresAt })
    },
    async disable({ path } = {}) {
      const jar = await cookies()
      if (path && jar.get(COOKIE.preview)) {
        // A preview-link viewer: their draft cookie, if any, is scoped to the shared page.
        jar.set(COOKIE.nextDraft, '', { ...cookieBase(false), path, maxAge: 0 })
      } else {
        ;(await draftMode()).disable()
      }
      jar.delete(COOKIE.mode)
      jar.delete(COOKIE.preview)
    },
    getMode: getOnPageMode,
  }
}

/** "edit", "view" or null for this request. Safe to call anywhere (returns null outside a request). */
export const getOnPageMode = (): Promise<OnPageMode | null> =>
  inDraft(async () => {
    const jar = await cookies()
    return readMode(jar.get(COOKIE.mode)?.value, jar)
  }, null)

/**
 * Should this request render drafts? `draftMode().isEnabled`, except that an
 * editor whose session ended (signed out) no longer sees drafts. Draft mode
 * turned on by something else (your own preview route) is respected.
 */
export const isDraftEnabled = (): Promise<boolean> =>
  inDraft(async () => {
    const jar = await cookies()
    const raw = jar.get(COOKIE.mode)?.value
    return raw === undefined || (await readMode(raw, jar)) !== null
  }, false)

/** Is this request a preview-link view (set by the proxy)? */
export const isSharedPreview = (): Promise<boolean> =>
  inDraft(async () => (await headers()).get(HEADER.shared) === '1', false)

/** What `onpageContext()` adds to a Payload read in edit mode. */
export type OnPageReadContext = { context?: { [CONTEXT_KEY]: true } }

/**
 * Spread into Payload reads that feed the page: in edit mode it turns on
 * auto-mapping markers, otherwise it is empty.
 *
 *   payload.find({ collection: 'pages', where, draft, ...(await onpageContext()) })
 */
export async function onpageContext(): Promise<OnPageReadContext> {
  return (await getOnPageMode()) === 'edit' ? { context: { [CONTEXT_KEY]: true } } : {}
}
