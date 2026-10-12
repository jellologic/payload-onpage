/**
 * The payload-onpage proxy (Next.js middleware). Required for preview links:
 * it unseals the `onpage_preview` grant and, only on the shared page and
 * before the grant expires, injects Next's draft-mode cookie into the request.
 * Static pages then render the draft for the viewer. It also guards Next's
 * draft cookie itself: on a CDN like Vercel's the viewer's browser holds it,
 * scoped to the shared page (nextSession `cdnBypass`), and the proxy strips it
 * from any request the grant doesn't cover, so a copied cookie unlocks nothing.
 * It verifies the seal on the editor's `onpage` mode cookie and strips forged
 * ones, and passes the request path to server components.
 *
 *   // proxy.ts (Next 16; middleware.ts on Next 15)
 *   import { createOnPageProxy } from '@payload-onpage/next/proxy'
 *   export const proxy = createOnPageProxy({ secret: process.env.PAYLOAD_SECRET })
 *   // Every page; skips assets by extension only, so dotted page paths are guarded too.
 *   export const config = {
 *     matcher: ['/((?!api|admin|_next/static|_next/image|.*\\.(?:ico|png|jpe?g|gif|webp|avif|svg|css|js|map|txt|xml|woff2?)$).*)'],
 *   }
 *
 * Already have one? `NextResponse.next({ request: { headers: await withOnPage(request, { secret }) } })`
 */
import {
  COOKIE,
  createModeCookie,
  HEADER,
  modeSealer,
  readModeCookie,
  SEAL_PURPOSE,
  isLivePreviewGrant,
  samePath,
  unseal,
  type ModeCookie,
} from '@payload-onpage/core'
import { NextResponse, type NextMiddleware, type NextRequest } from 'next/server.js'

const onVercel = () => typeof process !== 'undefined' && !!process.env.VERCEL

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
   * stripped before rendering.
   *
   * Default: strict on Vercel (where `cdnBypass` puts the cookie in viewers'
   * browsers), admitting only editors and preview-link pages; elsewhere the
   * cookie is stripped only when it arrives with a preview link for another
   * page. If your own preview route enables draft mode on Vercel, pass a check
   * for its users here.
   */
  allowDraft?: ((request: NextRequest) => boolean | Promise<boolean>) | undefined
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
  if (opts.secret && isLivePreviewGrant(grant) && samePath(path, grant.path)) {
    const view = await createModeCookie('view', {
      sealMode: modeSealer(opts.secret),
      expiresAt: new Date(grant.exp * 1000),
    })
    const cookie = withoutCookies(headers.get('cookie'), [COOKIE.nextDraft, COOKIE.mode])
    cookie.push(`${COOKIE.nextDraft}=${grant.draft}`, `${COOKIE.mode}=${view}`)
    headers.set('cookie', cookie.join('; '))
    headers.set(HEADER.shared, '1')
    return headers
  }
  // The editor's mode cookie counts only if its seal verifies. (Without a
  // secret nothing can be verified; createOnPageProxy warns about that.)
  const raw = request.cookies.get(COOKIE.mode)?.value
  const mode = opts.secret
    ? await readModeCookie(raw, (name) => request.cookies.get(name)?.value, opts.secret)
    : null
  const strip: string[] = []
  if (raw !== undefined && opts.secret && !mode) strip.push(COOKIE.mode)
  if (request.cookies.has(COOKIE.nextDraft) && !(await mayKeepDraft(request, opts, !!sealed, mode)))
    strip.push(COOKIE.nextDraft, COOKIE.mode)
  if (strip.length) headers.set('cookie', withoutCookies(headers.get('cookie'), strip).join('; '))
  return headers
}

/** No preview grant covers this page: may the request keep its own draft cookie? */
async function mayKeepDraft(
  request: NextRequest,
  opts: OnPageProxyOptions,
  hasPreviewCookie: boolean,
  mode: ModeCookie | null,
): Promise<boolean> {
  const allowDraft = opts.allowDraft ?? (onVercel() ? () => false : undefined)
  if (!allowDraft) return !hasPreviewCookie
  if (mode?.bound) return true // an editor, still signed in as the session that entered
  try {
    return await allowDraft(request)
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
