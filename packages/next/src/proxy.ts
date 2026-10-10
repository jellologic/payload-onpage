/**
 * The payload-onpage proxy (Next.js middleware). Required for preview links:
 * it unseals the `onpage_preview` grant and, only on the shared page and
 * before the grant expires, injects Next's draft-mode cookie into the request.
 * Static pages then render the draft for the viewer, while the browser never
 * holds a usable draft credential. It also passes the request path to server
 * components.
 *
 *   // proxy.ts (Next 16; middleware.ts on Next 15)
 *   import { createOnPageProxy } from '@payload-onpage/next/proxy'
 *   export const proxy = createOnPageProxy({ secret: process.env.PAYLOAD_SECRET })
 *   export const config = { matcher: ['/((?!_next|.*\\..*).*)'] }
 *
 * Already have one? `NextResponse.next({ request: { headers: await withOnPage(request, { secret }) } })`
 */
import { COOKIE, HEADER, SEAL_PURPOSE, samePath, unseal } from '@payload-onpage/core'
import { NextResponse, type NextRequest } from 'next/server.js'

export interface OnPageProxyOptions {
  /** Same secret as the plugin (default: Payload's `secret`, i.e. PAYLOAD_SECRET). */
  secret: string | undefined
}

interface PreviewGrant {
  path: string
  ref: string
  exp: number
  draft: string
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
  if (!sealed || !opts.secret) return headers
  const grant = await unseal<PreviewGrant>(sealed, opts.secret, SEAL_PURPOSE.previewCookie)
  if (
    !grant ||
    typeof grant.draft !== 'string' ||
    grant.exp * 1000 <= Date.now() ||
    !samePath(path, grant.path)
  ) {
    return headers
  }
  const cookie = withoutCookies(headers.get('cookie'), [COOKIE.nextDraft, COOKIE.mode])
  cookie.push(`${COOKIE.nextDraft}=${grant.draft}`, `${COOKIE.mode}=view`)
  headers.set('cookie', cookie.join('; '))
  headers.set(HEADER.shared, '1')
  return headers
}

export function createOnPageProxy(opts: OnPageProxyOptions) {
  if (!opts.secret)
    console.warn(
      'payload-onpage: createOnPageProxy() has no secret; preview links will show published content.',
    )
  return async function proxy(request: NextRequest) {
    return NextResponse.next({ request: { headers: await withOnPage(request, opts) } })
  }
}
