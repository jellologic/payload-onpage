# @payload-onpage/plugin

The Payload side: endpoints (enter/mode/exit/preview links/schema), access through Payload's own `docAccessOperation`, the editor schema, marker hooks, a stale-write guard, and **Edit on page** / **Copy preview link** in the admin.

![Editing a Payload CMS page in place: click the heading, type, and it autosaves as a draft](https://raw.githubusercontent.com/jellologic/payload-onpage/main/docs/media/edit-text.gif)

![Edit on page and Copy preview link in the Payload admin](https://raw.githubusercontent.com/jellologic/payload-onpage/main/docs/media/admin-controls.png)

```ts
import { onpage } from '@payload-onpage/plugin'
import { nextSession } from '@payload-onpage/next/session'

plugins: [onpage({ collections: ['pages'], globals: ['header'], session: nextSession() })]
```

Options: `collections`, `globals` (with per-document `fields` and `url`), `access`, `session`, `encode`, `previewLinkTTL`, `validatePreviewLink`, `secret`, `authCookie`, `routePrefix`, `enabled`. See [security](https://github.com/jellologic/payload-onpage/blob/main/docs/concepts/security.md).

Part of [**payload-onpage**](https://github.com/jellologic/payload-onpage): on-page editing and draft previews for Payload CMS + Next.js. Start with the [getting started guide](https://github.com/jellologic/payload-onpage/blob/main/docs/getting-started.md).

MIT licensed.

See the **[tour](https://github.com/jellologic/payload-onpage/blob/main/docs/tour.md)** and **[getting started](https://github.com/jellologic/payload-onpage/blob/main/docs/getting-started.md)**.
