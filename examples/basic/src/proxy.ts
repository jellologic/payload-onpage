// Required for preview links: injects draft mode for the shared page only (see @payload-onpage/next/proxy).
import { createOnPageProxy } from '@payload-onpage/next/proxy'
import { PAYLOAD_SECRET } from './secret'

export const proxy = createOnPageProxy({ secret: PAYLOAD_SECRET })

export const config = { matcher: ['/((?!api|_next|admin|.*\\..*).*)'] }
