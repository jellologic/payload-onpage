/**
 * Optional hardening for preview links (recommended). Cookies can't be scoped
 * to the root page alone, so a shared link to "/" would put the whole site in
 * draft mode. With this proxy (middleware), a preview-link viewer only gets
 * draft mode on the shared page: on any other path Next's draft cookie is
 * removed from the request before your code runs, so even direct
 * `draftMode()` reads see published content. It also passes the path to
 * `isDraftEnabled()`.
 *
 *   // proxy.ts (Next 16; middleware.ts on Next 15)
 *   export { onpageProxy as proxy } from '@payload-onpage/next/proxy'
 *   export const config = { matcher: ['/((?!_next|.*\\..*).*)'] }
 *
 * Already have one? Forward the headers it prepares:
 *   NextResponse.next({ request: { headers: withOnPagePath(request) } })
 */
import { NextResponse, type NextRequest } from 'next/server.js';
import { BYPASS_COOKIE, LINK_COOKIE, MODE_COOKIE, PATH_HEADER, safeDecode, samePath } from './constants.ts';

export { PATH_HEADER };

export function withOnPagePath(request: NextRequest, headers: Headers = new Headers(request.headers)): Headers {
  const path = request.nextUrl.pathname;
  headers.set(PATH_HEADER, path);
  const link = request.cookies.get(LINK_COOKIE)?.value;
  // Link viewer off the shared page (preview endpoints under the API stay untouched): no draft mode here.
  if (link && !samePath(path, safeDecode(link)) && !path.includes('/onpage/')) {
    const cookie = (headers.get('cookie') ?? '')
      .split(';')
      .map((c) => c.trim())
      .filter((c) => c && !c.startsWith(`${BYPASS_COOKIE}=`) && !c.startsWith(`${MODE_COOKIE}=`))
      .join('; ');
    if (cookie) headers.set('cookie', cookie);
    else headers.delete('cookie');
  }
  return headers;
}

export function onpageProxy(request: NextRequest) {
  return NextResponse.next({ request: { headers: withOnPagePath(request) } });
}
