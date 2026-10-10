// Optional: lets a shared preview link to "/" show drafts on the home page only.
export { onpageProxy as proxy } from '@payload-onpage/next/proxy'

export const config = { matcher: ['/((?!api|_next|admin|.*\\..*).*)'] }
