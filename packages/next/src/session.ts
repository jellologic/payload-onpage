/**
 * Next.js App Router session: edit/preview mode = Next draft mode + an
 * `onpage` cookie saying which mode.
 *
 * Preview links ("view" mode for people who can't sign in) are scoped to one
 * page: Next's draft-mode cookie and the mode cookie are both set with that
 * page's path, so other pages render published content even where the site
 * reads `draftMode()` directly. A site-wide `onpage_link` flag marks the
 * browser as a link viewer; `isDraftEnabled()` adds a second check on top.
 */
import { cookies, draftMode, headers } from 'next/headers.js'
import type { OnPageMode, SessionAdapter } from '@payload-onpage/core'
import {
  BYPASS_COOKIE,
  LINK_COOKIE,
  MODE_COOKIE,
  PATH_HEADER,
  safeDecode,
  samePath,
} from './constants.ts'

export { LINK_COOKIE, MODE_COOKIE, PATH_HEADER }

export interface NextSessionOptions {
  /** Max age of the edit/preview cookies in seconds. Default: browser session. */
  maxAge?: number
}

export function nextSession(opts: NextSessionOptions = {}): SessionAdapter {
  return {
    async enable(mode, { secure, path }) {
      ;(await draftMode()).enable()
      const jar = await cookies()
      const base = {
        httpOnly: true,
        sameSite: 'lax' as const,
        secure,
        ...(opts.maxAge ? { maxAge: opts.maxAge } : {}),
      }
      if (mode === 'view' && path) {
        const scope = path.split('?')[0] || '/'
        // Re-issue Next's draft cookie for this page only.
        const bypass = jar.get(BYPASS_COOKIE)?.value
        if (bypass)
          jar.set(BYPASS_COOKIE, bypass, {
            httpOnly: true,
            sameSite: secure ? 'none' : 'lax',
            secure,
            path: scope,
          })
        jar.set(MODE_COOKIE, 'view', { ...base, path: scope })
        // The link cookie remembers which page was shared (checked against the request path when known).
        jar.set(LINK_COOKIE, encodeURIComponent(scope), { ...base, path: '/' })
      } else {
        jar.set(MODE_COOKIE, mode, { ...base, path: '/' })
        jar.delete(LINK_COOKIE)
      }
    },
    async disable({ path } = {}) {
      const jar = await cookies()
      if (jar.get(LINK_COOKIE) && path) {
        // A link viewer's cookies live on the shared page's path; expire them there.
        // (One Set-Cookie per name per response, so this replaces draftMode().disable().)
        const scope = path.split('?')[0] || '/'
        jar.set(BYPASS_COOKIE, '', { path: scope, maxAge: 0 })
        jar.set(MODE_COOKIE, '', { path: scope, maxAge: 0 })
      } else {
        ;(await draftMode()).disable()
        jar.delete(MODE_COOKIE)
      }
      jar.delete(LINK_COOKIE)
    },
    getMode: getOnPageMode,
  }
}

/*
 * Static-safe: both helpers read draftMode().isEnabled first and touch cookies()
 * only when draft mode is on. Next exempts the isEnabled read from prerender
 * bailout, so pages stay static for visitors; draft requests render dynamically anyway.
 */

/** "edit", "view" or null for this request. Safe to call outside a request (returns null). */
export async function getOnPageMode(): Promise<OnPageMode | null> {
  try {
    if (!(await draftMode()).isEnabled) return null
    const jar = await cookies()
    const v = jar.get(MODE_COOKIE)?.value
    return v === 'edit' || v === 'view' ? v : null
  } catch {
    return null
  }
}

/**
 * Should this request render drafts? Like `draftMode().isEnabled`, except a
 * preview-link viewer only sees drafts on the shared page.
 */
export async function isDraftEnabled(): Promise<boolean> {
  try {
    if (!(await draftMode()).isEnabled) return false
    const jar = await cookies()
    const link = jar.get(LINK_COOKIE)?.value
    if (!link) return true
    if (jar.get(MODE_COOKIE)?.value !== 'view') return false
    // With onpageProxy() installed, the request path is known: only the shared page shows drafts.
    // Without it, the cookies' path scope does the limiting (a link to "/" can't be narrowed that way).
    const here = (await headers()).get(PATH_HEADER)
    return here == null || samePath(here, safeDecode(link))
  } catch {
    return false
  }
}

/**
 * Spread into Payload reads that feed the page: in edit mode it turns on
 * auto-mapping markers, otherwise it is empty.
 *
 *   payload.find({ collection: 'pages', where, draft, ...(await onpageContext()) })
 */
export async function onpageContext(): Promise<{ context?: { onpage: true } }> {
  return (await getOnPageMode()) === 'edit' ? { context: { onpage: true } } : {}
}
