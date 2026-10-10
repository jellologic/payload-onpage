/**
 * Optional hardening for preview links. Next.js server components can't see
 * the request path, so a shared link to "/" would otherwise unlock drafts
 * site-wide (cookies can't be scoped to the root page alone). This proxy
 * (middleware) passes the path to `isDraftEnabled()`, which then shows drafts
 * on the shared page only.
 *
 *   // proxy.ts (Next 16; middleware.ts on Next 15)
 *   export { onpageProxy as proxy } from '@payload-onpage/next/proxy'
 *   export const config = { matcher: ['/((?!api|_next|admin|.*\\..*).*)'] }
 *
 * Already have one? Call `withOnPagePath(request)` and pass its headers on:
 *   NextResponse.next({ request: { headers: withOnPagePath(request) } })
 */
import { NextResponse, type NextRequest } from 'next/server.js';
import { PATH_HEADER } from './constants.ts';

export function withOnPagePath(request: NextRequest, headers: Headers = new Headers(request.headers)): Headers {
  headers.set(PATH_HEADER, request.nextUrl.pathname);
  return headers;
}

export { PATH_HEADER };

export function onpageProxy(request: NextRequest) {
  return NextResponse.next({ request: { headers: withOnPagePath(request) } });
}
