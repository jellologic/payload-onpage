# @payload-onpage/react

The editor UI: overlay, row toolbars, settings, dock, preview toolbar, field editors, locators, annotations and client mode. Framework-agnostic; [`@payload-onpage/next`](../next) mounts it for Next.js.

```tsx
import { editable } from '@payload-onpage/react/annotations' // server-safe
import { OnPageClient } from '@payload-onpage/react/client' // client mode, ~1.7 KB
```

Entries: `.` (editor, editors, locators, messages), `./annotations`, `./client`, `./editor-kit` (building blocks for [custom field editors](https://github.com/jellologic/payload-onpage/blob/main/docs/guides/custom-field-editor.md)).

Part of [**payload-onpage**](https://github.com/jellologic/payload-onpage): on-page editing and draft previews for Payload CMS + Next.js. Start with the [getting started guide](https://github.com/jellologic/payload-onpage/blob/main/docs/getting-started.md).

MIT licensed.
