# payload-onpage

[![CI](https://github.com/jellologic/payload-onpage/actions/workflows/ci.yml/badge.svg)](https://github.com/jellologic/payload-onpage/actions/workflows/ci.yml) [![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

On-page editing and draft previews for **Payload CMS 3 + Next.js App Router**. Editors click the text, images and sections they see on the page and change them in place. They can share a draft with anyone through a signed link. Every save goes through Payload's REST API, so access control, hooks, validation, drafts and versions behave exactly as they do in the admin.

| Package | What it is |
|---|---|
| `@payload-onpage/core` | Framework-free building blocks: document refs, schema, path and field operations, the invisible-marker codec, autosave, the multi-document `EditorSession`, and the **port interfaces** |
| `@payload-onpage/plugin` | The Payload plugin: endpoints, auto-mapping, marker stripping, and admin buttons |
| `@payload-onpage/react` | The editor UI: overlay, row toolbars, settings panel, dock, preview toolbar, field editors, annotations, and client mode |
| `@payload-onpage/next` | The Next.js adapter: draft-mode session, `<OnPage />`, `onpageContext()`, and the `router.refresh()` renderer |
| `@payload-onpage/lexical` | Inline rich-text editing that reads and writes Payload's Lexical JSON |

## Try it

```bash
git clone https://github.com/jellologic/payload-onpage && cd payload-onpage
bun install && bun run dev:example     # http://localhost:3100, SQLite, seeds itself
```

Open http://localhost:3100/admin (you're signed in automatically as `dev@example.com`). Open the Home page and press **Edit on page**. The example shows auto-mapped text, a global edited alongside the page, select/date/relationship/color editors, rich text, a client-mode page (`/about`) and share links.

## Install

```bash
npm i @payload-onpage/plugin @payload-onpage/next @payload-onpage/react @payload-onpage/core @payload-onpage/lexical
```

Requires Payload 3, Next.js 15 or 16 (App Router), and React 19.

## Quickstart (three steps)

**1. Register the plugin.**

```ts
// payload.config.ts
import { onpage } from '@payload-onpage/plugin'
import { nextSession } from '@payload-onpage/next/session' // the /session entry has no client code

export default buildConfig({
  plugins: [onpage({ collections: ['pages', 'posts'], globals: ['header'], session: nextSession() })],
})
```

**2. Mount the editor once.** Outside edit and preview mode it renders nothing.

```tsx
// app/(frontend)/layout.tsx
import { Suspense } from 'react'
import { OnPage } from '@payload-onpage/next'
// …
<body>
  {children}
  <Suspense fallback={null}><OnPage /></Suspense>
</body>
```

**3. Ask for markers where the page reads drafts.**

```ts
import { isDraftEnabled, onpageContext } from '@payload-onpage/next'

const draft = await isDraftEnabled()
const page = await payload.find({ collection: 'pages', where, draft, ...(await onpageContext()) })
```

That's it, with no component changes. Each document gets **Edit on page** and **Copy preview link** buttons in the admin. Text, textarea, rich-text and image fields become clickable on the page, and array and blocks rows get move, duplicate, delete and settings controls.

### How it finds fields: auto-mapping

In edit mode, `onpageContext()` asks the plugin to append an **invisible marker** to each string it reads. The marker records which document and field the string came from. In the browser, a locator finds those markers in text nodes and in `<img alt>`, the image's alt text, so an image maps to its upload field. Rows of arrays and blocks are inferred from where their fields render.

Markers are written only for reads that ask for them. They are never written for REST or admin reads, and a `beforeChange` hook strips them from every write, so they can't be persisted.

### Making mapping exact: annotations

Annotations are optional. Use them for images without alt text, for sections whose wrapper element you want exact, and for empty lists that should show **+ Add**.

```tsx
import { editable } from '@payload-onpage/react/annotations' // server-safe, zero runtime outside edit mode

const e = editable({ collection: 'pages', doc: page }, { enabled: (await getOnPageMode()) === 'edit' })
<section {...e.row('layout.2', 'Hero')}>
  <img {...e.media('layout.2.image')} />
  <ul {...e.list('layout.2.items', 'Feature')}>…</ul>
</section>
```

### Instant updates: client mode

By default each save triggers `router.refresh()`. While the server render is on its way, the editor shows the new text in place. To get zero-latency updates, render a document from editor state. The `render` prop is a function, so this has to live in a client component:

```tsx
'use client'
import { OnPageClient } from '@payload-onpage/react/client'

export const LivePage = ({ page }) => (
  <OnPageClient collection="pages" doc={page} render={(page, e) => <Page page={page} e={e} />} />
)
```

Client mode auto-maps too: the state it renders carries the same markers (`autoMap={false}` turns that off).

## Ports and adapters

Every point where the editor touches the outside world is an interface in `@payload-onpage/core`. The defaults ship with the packages, and you can replace any of them.

| Port | Responsibility | Default | Replace with… |
|---|---|---|---|
| `DataSource` | Load the schema and documents; save drafts; publish; search for relationships | `payloadRest()` | GraphQL, server actions, custom auth headers |
| `MediaLibrary` | Search and upload images | `payloadUploads()` | A DAM (Cloudinary, Bynder…) |
| `Locator` | Map DOM elements to `{ doc, path, kind }` | `composite(annotations(), stega())` | Your own data attributes or markup conventions |
| `Renderer` | Show a saved change | `useNextRefresh()`; `clientState()`, `fullReload()` | Another router |
| `SessionAdapter` | Enter and leave edit or preview mode (server) | `nextSession()` | Another framework |
| Field editors | Edit one kind of field | text, textarea, email, select, radio, checkbox, number, date, relationship, upload, color, richText | Anything |

### Writing a field editor

```tsx
'use client'
import { Popover, type FieldEditorProps } from '@payload-onpage/react'

function JsonEditor({ field, value, element, commit, close }: FieldEditorProps) {
  const [text, setText] = useState(JSON.stringify(value, null, 2))
  return (
    <Popover anchor={element} title={field.label} onClose={close}>
      <textarea value={text} onChange={(e) => setText(e.target.value)} />
      <button onClick={() => { commit(JSON.parse(text)); close() }}>Apply</button>
    </Popover>
  )
}
```

Register it from your own client mount and pass that mount to `<OnPage mount={…} />`:

```tsx
'use client'
import { OnPageMount, type OnPageMountProps } from '@payload-onpage/next/client'
export const Mount = (p: OnPageMountProps) => <OnPageMount {...p} editors={{ json: { mode: 'popover', component: JsonEditor } }} />
```

Each field resolves its editor in this order:
1. `admin: { custom: { onpage: { editor: 'json' } } }` on the field
2. The kind the element declares (text, textarea, richtext or media)
3. The editor registered for the field's type

`null` removes a default editor.

### Writing a DataSource

Implement `loadSchema`, `loadDocument`, `saveDraft` and `publish` (plus `search` if you want relationship search). `saveDraft` receives only the changed top-level fields and the `updatedAt` it last saw. Return `{ ok: false, status: 409 }` on a stale write, and the dock offers **Reload latest**.

## Endpoints (added by the plugin, under `/api/onpage`)

| Method | Path | Does |
|---|---|---|
| GET | `/schema/:kind/:slug` | Editable field schema, including static defaults (editors only) |
| GET | `/enter?kind&slug&id&mode&locale&path` | Turns on draft mode in edit or view mode and redirects to the page |
| GET | `/exit?path` | Leaves edit or preview mode |
| GET | `/mode?mode&path` | Switches the current page between editing and previewing (signed-in editors only) |
| GET | `/search/:slug?q` | Finds documents by `useAsTitle`, with the user's read access |
| POST | `/preview-link` | Creates a signed, expiring read-only link (editors only) |
| GET | `/preview?token` | Opens a preview link |

## Security

- **Who can edit:** the `access` option, or by default each document's own `update` access. Every write is a normal authenticated REST call, so Payload enforces access again on each save.
- **Preview links** are HMAC-SHA256 tokens signed with `payload.secret`, carrying the document, the path and an expiry (default 7 days, set with `previewLinkTTL`).
  - Opening a link turns on draft mode **for that page's path only**: Next's draft cookie and the mode cookie are both issued with the page path. Other pages render published content even where your site reads `draftMode()` directly.
  - `isDraftEnabled()` adds a second check on top.
  - A tampered or expired token gets a 403.
- **Markers** exist only in responses for reads that pass `onpageContext()`, which happens only in edit mode. They are stripped on every write.
- **Shared links to the home page.** Cookies can't be scoped to `/` alone, and server components can't see the request path. Without help, a link to `/` would show drafts site-wide. Install the optional proxy so `isDraftEnabled()` can compare paths:

  ```ts
  // proxy.ts (Next 16; middleware.ts on Next 15)
  export { onpageProxy as proxy } from '@payload-onpage/next/proxy'
  export const config = { matcher: ['/((?!api|_next|admin|.*\\..*).*)'] }
  ```

  Even with the proxy, code that reads `draftMode()` directly can't benefit. Use `isDraftEnabled()` wherever drafts are fetched.
- **Static pages stay static.** `<OnPage />` and the session helpers read `draftMode().isEnabled` first and touch `cookies()` only when draft mode is on.

## FAQ

**Does it change my public HTML?** No. Without draft mode, `<OnPage />` renders nothing, and annotations return `{}`.

**My string comparison fails in edit mode.** Markers are appended to strings. Use `stegaClean(value)` from `@payload-onpage/core` before comparing or slicing. Some fields are never marked:
- fields whose names look machine-readable: `url`, `href`, `slug`, `email`, `key`, `color` and similar
- fields that use a non-text editor (for example `admin.custom.onpage.editor: 'color'`)

To narrow marking further, use the plugin's `encode` option.

**Localized fields?** The editor edits the page's `<html lang>` locale, or the one you pass to `<OnPage locale>`. Structural changes such as adding or moving rows apply to every locale, and the dock says so.

**Device previews?** Preview mode's toolbar opens the same page in a phone- or tablet-width frame. The toolbar and editor stay out of the frame.

## Development

```bash
bun install
bun run test        # builds all packages (tsc -b) and runs the test suites
bun run dev:example # the example site on :3100
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
