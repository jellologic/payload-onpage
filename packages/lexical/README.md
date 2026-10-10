# @payload-onpage/lexical

Inline rich-text editing for Payload's Lexical `richText` fields. Reads and writes Payload's Lexical JSON, keeps Payload's link shape, and preserves nodes it doesn't edit (uploads, blocks…). The editor loads lazily, only when a rich-text field opens.

```tsx
import { lexicalEditors } from '@payload-onpage/lexical' // included by @payload-onpage/next by default
```

Peers: `lexical` and `@lexical/*` `~0.41.0`, the versions Payload's `@payloadcms/richtext-lexical` uses. Entries: `.` (registry, converters), `./editor` (component and nodes).

Part of [**payload-onpage**](https://github.com/jellologic/payload-onpage): on-page editing and draft previews for Payload CMS + Next.js. Start with the [getting started guide](https://github.com/jellologic/payload-onpage/blob/main/docs/getting-started.md).

MIT licensed.
