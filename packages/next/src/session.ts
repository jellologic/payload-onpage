/**
 * Next.js App Router session adapter and helpers.
 *
 * Editors: Next draft mode plus an `onpage` cookie saying which mode, bound to
 * a hash of their auth cookie, so signing out (or in as someone else) ends it.
 *
 * Preview links: the browser gets only a sealed grant (`onpage_preview`). The
 * proxy (./proxy) unseals it and injects draft mode into the request for the
 * shared page only. The raw Next.js draft secret never reaches the browser.
 *
 * All helpers read `draftMode().isEnabled` first and touch cookies only when
 * draft mode is on. Next exempts that read from prerender bailout, so pages
 * stay static for visitors.
 */
import {
  CONTEXT_KEY,
  COOKIE,
  HEADER,
  isOnPageMode,
  sha256,
  type OnPageMode,
  type SessionAdapter,
} from '@payload-onpage/core'
import { cookies, draftMode, headers } from 'next/headers.js'

export interface NextSessionOptions {
  /** How long an editor's edit/preview mode lasts, in seconds. Default 12 hours. */
  maxAge?: number
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

const HASH_LENGTH = 32
const fingerprint = async (token: string) => (await sha256(token)).slice(0, HASH_LENGTH)

/** `edit` | `view`, or `<mode>:<authCookie>:<hash>` when bound to a session. */
async function modeValue(mode: OnPageMode, jar: Jar, bindTo?: string): Promise<string> {
  const token = bindTo ? jar.get(bindTo)?.value : undefined
  return token ? `${mode}:${bindTo}:${await fingerprint(token)}` : mode
}

/** The mode a cookie value grants in this request, or null (unknown, or the bound session is gone). */
async function readMode(raw: string | undefined, jar: Jar): Promise<OnPageMode | null> {
  if (!raw) return null
  const [mode, bound, hash] = raw.split(':')
  if (!isOnPageMode(mode)) return null
  if (bound) {
    const token = jar.get(bound)?.value
    if (!token || (await fingerprint(token)) !== hash) return null
  }
  return mode
}

export function nextSession(opts: NextSessionOptions = {}): SessionAdapter {
  const maxAge = opts.maxAge ?? 12 * 3600
  return {
    async enable(mode, { secure, bindTo }) {
      ;(await draftMode()).enable()
      const jar = await cookies()
      jar.set(COOKIE.mode, await modeValue(mode, jar, bindTo), { ...cookieBase(secure), maxAge })
      jar.delete(COOKIE.preview)
    },
    async enableLink({ secure, path: _path, expiresAt, seal }) {
      ;(await draftMode()).enable()
      const jar = await cookies()
      const draft = jar.get(COOKIE.nextDraft)?.value
      if (!draft) throw new Error('payload-onpage: Next.js did not set its draft-mode cookie')
      // Keep the draft secret server-side: the browser only gets the sealed grant.
      jar.delete(COOKIE.nextDraft)
      jar.delete(COOKIE.mode)
      jar.set(COOKIE.preview, await seal(draft), { ...cookieBase(secure), expires: expiresAt })
    },
    async disable() {
      ;(await draftMode()).disable()
      const jar = await cookies()
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
