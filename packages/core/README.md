# @payload-onpage/core

Framework-free building blocks: document refs, paths and field operations, the editor session (multi-document, undo, serialized publish/discard), autosave with stale-write detection, invisible field markers, sealing, and the **port interfaces** adapters implement.

```ts
import { EditorSession } from '@payload-onpage/core'
import { payloadRest } from '@payload-onpage/core/payload'

const session = new EditorSession({ dataSource: payloadRest() })
await session.open({ kind: 'collection', slug: 'pages', id: 1 })
session.setValue('c:pages:1', 'title', 'Hello')
await session.publish()
```

Entries: `@payload-onpage/core` (logic, ports), `@payload-onpage/core/payload` (Payload REST `DataSource` + `MediaLibrary`).

Part of [**payload-onpage**](https://github.com/jellologic/payload-onpage): on-page editing and draft previews for Payload CMS + Next.js. Start with the [getting started guide](https://github.com/jellologic/payload-onpage/blob/main/docs/getting-started.md).

MIT licensed.
