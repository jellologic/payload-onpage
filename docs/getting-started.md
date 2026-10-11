# Getting started

Add on-page editing and shareable draft previews to an existing **Payload 3 + Next.js App Router** site. Nothing changes for visitors: no extra markup, about 0.3 KB of JavaScript.

> **For coding agents:** follow these steps in order. Each names the file to edit and ends with a check. The canonical working setup is [`examples/basic`](../examples/basic); its file paths are cited below.

## 1. Install

```bash
npm i @payload-onpage/plugin @payload-onpage/next @payload-onpage/react @payload-onpage/core @payload-onpage/lexical
```

Lexical is a peer dependency. Sites using `@payloadcms/richtext-lexical` already have it, at the same version.

## 2. Register the plugin

`payload.config.ts` ([example](../examples/basic/src/payload.config.ts)):

```ts
import { onpage } from '@payload-onpage/plugin'
import { nextSession } from '@payload-onpage/next/session' // the /session entry has no client code

export default buildConfig({
  // …
  serverURL: process.env.SERVER_URL, // required in production (redirects, preview links, Secure cookies)
  plugins: [
    onpage({
      collections: ['pages'], // or { pages: { fields: ['title', 'layout'], url: ({ doc }) => `/${doc.slug}` } }
      globals: ['header'],
      session: nextSession(),
    }),
  ],
})
```

Collections must have **drafts** enabled (`versions: { drafts: true }`), so edits save as drafts until published. The page URL comes from the `url` option, then the collection's `admin.preview`, then `/<slug>`.

**Check:** open a document in the admin. **Edit on page** and **Copy preview link** appear beside the document controls.

Every enabled collection and global then gets **Edit on page** and **Copy preview link** in the admin:

![Edit on page and Copy preview link beside Payload's document controls](media/admin-controls.png)

## 3. Mount the editor

The frontend root layout ([example](<../examples/basic/src/app/(frontend)/layout.tsx>)):

```tsx
import { Suspense } from 'react'
import { OnPage } from '@payload-onpage/next'

export default function Layout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Suspense fallback={null}>
          <OnPage />
        </Suspense>
      </body>
    </html>
  )
}
```

`<OnPage />` renders nothing unless an editor turned on edit or preview mode. It reads cookies only in draft mode, so static pages stay static.

## 4. Read drafts with markers

Wherever the page reads Payload ([example](../examples/basic/src/lib/data.ts)):

```ts
import { isDraftEnabled, onpageContext } from '@payload-onpage/next'

const draft = await isDraftEnabled()
const { docs } = await payload.find({
  collection: 'pages',
  where: { slug: { equals: slug } },
  draft,
  ...(await onpageContext()), // in edit mode: invisible field markers (auto-mapping)
})
```

Use `isDraftEnabled()` rather than `draftMode().isEnabled`: it also ends draft access for editors who signed out.

**Check:** click **Edit on page**. The page opens with a dock at the bottom; click any heading or paragraph to edit it.

## 5. Add the proxy (required for preview links)

`proxy.ts` (Next 16) or `middleware.ts` (Next 15), next to `app/` ([example](../examples/basic/src/proxy.ts)):

```ts
import { createOnPageProxy } from '@payload-onpage/next/proxy'

export const proxy = createOnPageProxy({ secret: process.env.PAYLOAD_SECRET }) // Next 15: export as `middleware`
export const config = { matcher: ['/((?!api|_next|admin|.*\\..*).*)'] }
```

Already have one? Forward the headers it prepares:

```ts
import { withOnPage } from '@payload-onpage/next/proxy'
return NextResponse.next({
  request: { headers: await withOnPage(request, { secret: process.env.PAYLOAD_SECRET }) },
})
```

**Check:** copy a preview link in the admin and open it in a private window. The draft shows with a "Shared preview" bar; other pages show published content.

## 6. Verify nothing leaks to visitors

```bash
curl -s https://your-site.test/ | grep -c 'data-onpage'   # → 0
```

## Next

- Make images, rows and non-text fields clickable: [annotations](guides/annotations.md).
- Instant updates while typing: [client mode](guides/client-mode.md).
- Production hardening: [security](concepts/security.md).

## Prompt for your coding agent

> Add payload-onpage to this Payload + Next.js site following https://github.com/jellologic/payload-onpage/blob/main/docs/getting-started.md. Enable it for the collections that render pages (with drafts on) and for any globals shown on every page. Mount `<OnPage />` in the frontend root layout inside Suspense, spread `onpageContext()` into every draft read that feeds a page, switch draft checks to `isDraftEnabled()`, and add the proxy (merge into an existing middleware if there is one). Then verify: the admin shows "Edit on page"; clicking it lets you edit text; `curl` of a public page contains no `data-onpage`.
