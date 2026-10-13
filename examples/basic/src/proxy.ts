// Required for preview links: injects draft mode for the shared page only (see @payload-onpage/next/proxy).
import { createOnPageProxy } from '@payload-onpage/next/proxy'
import { PAYLOAD_SECRET } from './secret'

export const proxy = createOnPageProxy({ secret: PAYLOAD_SECRET })

export const config = {
  matcher: [
    '/((?!api|admin|_next/static|_next/image|.*\\.(?:ico|png|jpe?g|gif|webp|avif|svg|css|js|map|txt|xml|woff2?)$).*)',
  ],
}
