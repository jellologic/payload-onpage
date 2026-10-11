# @payload-onpage/tanstack-start

payload-onpage for TanStack Start: the session adapter (cookie edit/preview mode, sealed preview grants), `<OnPage />`, `onpageContext()`, `isDraftEnabled()`, and the `router.invalidate()` renderer.

```tsx
// payload.config.ts (import from /session: it has no client code)
import { tanstackSession } from '@payload-onpage/tanstack-start/session'
plugins: [onpage({ collections: ['pages'], session: tanstackSession({ secret: process.env.PAYLOAD_SECRET }) })]

// root route — renders nothing for visitors
<OnPage />

// where a loader reads Payload
import { isDraftEnabled, onpageContext } from '@payload-onpage/tanstack-start/session'
const draft = await isDraftEnabled()
payload.find({ collection: 'pages', draft, ...(await onpageContext()) })
```

Entries: `.` (`OnPage`, mount), `./client` (`OnPageMount`, `useTanstackRefresh`), `./session` (server-only: session adapter, draft helpers).

Part of [**payload-onpage**](https://github.com/jellologic/payload-onpage): on-page editing and draft previews for Payload CMS. Start with the [getting started guide](https://github.com/jellologic/payload-onpage/blob/main/docs/getting-started.md).

MIT licensed.
