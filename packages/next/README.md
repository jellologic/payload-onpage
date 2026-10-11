# @payload-onpage/next

payload-onpage for the Next.js App Router: the session adapter (draft mode, editor binding, sealed preview grants), `<OnPage />`, `onpageContext()`, `isDraftEnabled()`, the `router.refresh()` renderer and the proxy for share links.

![Editing a Payload CMS page in place: click the heading, type, and it autosaves as a draft](https://raw.githubusercontent.com/jellologic/payload-onpage/main/docs/media/edit-text.gif)

![Previewing a draft at phone and tablet widths](https://raw.githubusercontent.com/jellologic/payload-onpage/main/docs/media/preview.gif)

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

See the **[tour](https://github.com/jellologic/payload-onpage/blob/main/docs/tour.md)** and **[getting started](https://github.com/jellologic/payload-onpage/blob/main/docs/getting-started.md)**.

---

_Found a bug? [Report it](https://github.com/jellologic/payload-onpage/issues/new?template=bug_report.yml) or see [CONTRIBUTING.md](https://github.com/jellologic/payload-onpage/blob/main/CONTRIBUTING.md) to fix it yourself._
