# @payload-onpage/lexical

Inline rich-text editing for Payload's Lexical `richText` fields. Reads and writes Payload's Lexical JSON, keeps Payload's link shape, and preserves nodes it doesn't edit (uploads, blocks…). The editor loads lazily, only when a rich-text field opens.

![Editing a Payload CMS page in place: click the heading, type, and it autosaves as a draft](https://raw.githubusercontent.com/jellologic/payload-onpage/main/docs/media/edit-text.gif)

![Inline Lexical rich-text editing with a formatting toolbar](https://raw.githubusercontent.com/jellologic/payload-onpage/main/docs/media/rich-text.png)

```tsx
import { lexicalEditors } from '@payload-onpage/lexical' // included by @payload-onpage/next by default
```

Peers: `lexical` and `@lexical/*` `~0.50.0`, the versions Payload 3.90's `@payloadcms/richtext-lexical` uses. Entries: `.` (registry, converters), `./editor` (component and nodes).

Part of [**payload-onpage**](https://github.com/jellologic/payload-onpage): on-page editing and draft previews for Payload CMS + Next.js. Start with the [getting started guide](https://github.com/jellologic/payload-onpage/blob/main/docs/getting-started.md).

MIT licensed.

See the **[tour](https://github.com/jellologic/payload-onpage/blob/main/docs/tour.md)** and **[getting started](https://github.com/jellologic/payload-onpage/blob/main/docs/getting-started.md)**.

---

_Found a bug? [Report it](https://github.com/jellologic/payload-onpage/issues/new?template=bug_report.yml) or see [CONTRIBUTING.md](https://github.com/jellologic/payload-onpage/blob/main/CONTRIBUTING.md) to fix it yourself._
