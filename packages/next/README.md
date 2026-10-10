# @payload-onpage/next

payload-onpage for the Next.js App Router: the session adapter (draft mode, editor binding, sealed preview grants), `<OnPage />`, `onpageContext()`, `isDraftEnabled()`, the `router.refresh()` renderer and the proxy for share links.

```tsx
// layout
import { OnPage } from '@payload-onpage/next'
;<Suspense fallback={null}>
  <OnPage />
</Suspense>

// proxy.ts
import { createOnPageProxy } from '@payload-onpage/next/proxy'
export const proxy = createOnPageProxy({ secret: process.env.PAYLOAD_SECRET })
```

Entries: `.` (server: `OnPage`, session helpers), `./client` (`OnPageMount`, `OnPageClient`, `useNextRefresh`), `./session` (no client code; for payload.config), `./proxy` (edge).

Part of [**payload-onpage**](https://github.com/jellologic/payload-onpage): on-page editing and draft previews for Payload CMS + Next.js. Start with the [getting started guide](https://github.com/jellologic/payload-onpage/blob/main/docs/getting-started.md).

MIT licensed.
