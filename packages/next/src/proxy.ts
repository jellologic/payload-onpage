/**
 * The payload-onpage proxy (Next.js middleware). Required for preview links:
 * it unseals the `onpage_preview` grant and, only on the shared page and
 * before the grant expires, injects Next's draft-mode cookie into the request.
 * Static pages then render the draft for the viewer. It also guards Next's
 * draft cookie itself: on a CDN like Vercel's the viewer's browser holds it,
 * scoped to the shared page (nextSession `cdnBypass`), and the proxy strips it
 * from any request the grant doesn't cover, so a copied cookie unlocks nothing.
 * It also passes the request path to server components.
 *
 *   // proxy.ts (Next 16; middleware.ts on Next 15)
 *   import { createOnPageProxy } from '@payload-onpage/next/proxy'
 *   export const proxy = createOnPageProxy({ secret: process.env.PAYLOAD_SECRET })
 *   export const config = { matcher: ['/((?!_next|.*\\..*).*)'] }
 *
 * Already have one? `NextResponse.next({ request: { headers: await withOnPage(request, { secret }) } })`
 */
import {
  COOKIE,
  HEADER,
  SEAL_PURPOSE,
  isLivePreviewGrant,
  samePath,
  unseal,
} from '@payload-onpage/core'
import { NextResponse, type NextMiddleware, type NextRequest } from 'next/server.js'
import { readModeCookie } from './binding.ts'

export interface OnPageProxyOptions {
  /** Same secret as the plugin (default: Payload's `secret`, i.e. PAYLOAD_SECRET). */
  secret: string | undefined
  /**
   * Strict draft guard. Next's draft cookie is one site-wide key, so once a
   * preview-link viewer's browser holds it (`cdnBypass`), anyone who copies it
   * could read every draft. With `allowDraft`, a request keeps the draft cookie
   * only on the page its preview link covers, for an editor whose bound
   * session is still signed in, or when `allowDraft` says so (e.g. your own
   * preview route's users: check the session is an admin). Otherwise it's
   * stripped before rendering. Without it, the cookie is stripped only when it
   * arrives with a preview link for another page.
   */
  allowDraft?: (request: NextRequest) => boolean | Promise<boolean>
}

const withoutCookies = (header: string | null, names: string[]) =>
  (header ?? '')
    .split(';')
    .map((c) => c.trim())
    .filter((c) => c && !names.some((n) => c.startsWith(`${n}=`)))

/** Request headers for the rest of the pipeline, with draft mode injected for a valid grant. */
export async function withOnPage(
  request: NextRequest,
  opts: OnPageProxyOptions,
  headers: Headers = new Headers(request.headers),
): Promise<Headers> {
  const path = request.nextUrl.pathname
  headers.delete(HEADER.shared) // never trust it from the client
  headers.set(HEADER.path, path)
  const sealed = request.cookies.get(COOKIE.preview)?.value
  const grant =
    sealed && opts.secret ? await unseal(sealed, opts.secret, SEAL_PURPOSE.previewCookie) : null
  if (isLivePreviewGrant(grant) && samePath(path, grant.path)) {
    const cookie = withoutCookies(headers.get('cookie'), [COOKIE.nextDraft, COOKIE.mode])
    cookie.push(`${COOKIE.nextDraft}=${grant.draft}`, `${COOKIE.mode}=view`)
    headers.set('cookie', cookie.join('; '))
    headers.set(HEADER.shared, '1')
    return headers
  }
  if (request.cookies.has(COOKIE.nextDraft) && !(await mayKeepDraft(request, opts, !!sealed))) {
    headers.set(
      'cookie',
      withoutCookies(headers.get('cookie'), [COOKIE.nextDraft, COOKIE.mode]).join('; '),
    )
  }
  return headers
}

/** No preview grant covers this page: may the request keep its own draft cookie? */
async function mayKeepDraft(
  request: NextRequest,
  opts: OnPageProxyOptions,
  hasPreviewCookie: boolean,
): Promise<boolean> {
  if (!opts.allowDraft) return !hasPreviewCookie
  const mode = await readModeCookie(
    request.cookies.get(COOKIE.mode)?.value,
    (name) => request.cookies.get(name)?.value,
  )
  if (mode?.bound) return true // an editor, still signed in as the session that entered
  try {
    return await opts.allowDraft(request)
  } catch {
    return false // fail closed: published content, never someone else's drafts
  }
}

export function createOnPageProxy(opts: OnPageProxyOptions): NextMiddleware {
  if (!opts.secret)
    console.warn(
      'payload-onpage: createOnPageProxy() has no secret; preview links will show published content.',
    )
  return async function proxy(request: NextRequest) {
    return NextResponse.next({ request: { headers: await withOnPage(request, opts) } })
  }
}
