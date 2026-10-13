# Payload's website template

Payload's [website template](https://github.com/payloadcms/payload/tree/main/templates/website) (`npx create-payload-app -t website`) has its own preview route, cached globals and Live Preview. This guide adds payload-onpage to it alongside them. Follow [Getting started](../getting-started.md) for the general steps; the template-specific parts are below.

## 1. The plugin: say where pages live

The template's `admin.preview` returns its preview route, `/next/preview?path=/about&previewSecret=…`, not the page. payload-onpage uses the `path` from it, and logs a warning. Set `url` to skip the guesswork:

```ts
// src/plugins/index.ts
import { onpage } from '@payload-onpage/plugin'
import { nextSession } from '@payload-onpage/next/session'

export const plugins: Plugin[] = [
  // …the template's plugins
  onpage({
    collections: {
      pages: { url: ({ doc }) => (doc.slug === 'home' ? '/' : `/${String(doc.slug)}`) },
      posts: { url: ({ doc }) => `/posts/${String(doc.slug)}` },
    },
    globals: ['header', 'footer'],
    session: nextSession(),
  }),
]
```

**Header and footer have no drafts** (`versions: false`), so on-page edits to them would go live as they autosave, and the plugin warns about that at startup. Either give them drafts:

```ts
// src/Header/config.ts and src/Footer/config.ts
versions: { drafts: true },
```

or leave them out of `globals` so only pages and posts are edited on the page.

## 2. Mount the editor

In `src/app/(frontend)/layout.tsx`, next to `<AdminBar>`:

```tsx
import { Suspense } from 'react'
import { OnPage } from '@payload-onpage/next'

// inside <Providers>, after {children} and <Footer />
;<Suspense fallback={null}>
  <OnPage />
</Suspense>
```

The template's `AdminBar` can stay. Editors then have both its bar (at the top) and the on-page dock (at the bottom).

## 3. Reads: drafts with markers

### Pages and posts

`queryPageBySlug` in `src/app/(frontend)/[slug]/page.tsx` and `queryPostBySlug` in `src/app/(frontend)/posts/[slug]/page.tsx` read with `draftMode()`. Switch them to the payload-onpage helpers:

```ts
import { isDraftEnabled, onpageContext } from '@payload-onpage/next'

const queryPageBySlug = cache(async ({ slug }: { slug: string }) => {
  const draft = await isDraftEnabled()
  const payload = await getPayload({ config: configPromise })
  const result = await payload.find({
    collection: 'pages',
    depth: 2,
    draft,
    limit: 1,
    pagination: false,
    overrideAccess: draft,
    where: { slug: { equals: slug } },
    ...(await onpageContext()), // edit mode: field markers for click-to-edit
  })
  return result.docs?.[0] || null
})
```

`generateMetadata` uses the same query, so in edit mode the title and description carry invisible markers. Strip them there:

```ts
import { stegaCleanDeep } from '@payload-onpage/core'

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug = 'home' } = await params
  const page = await queryPageBySlug({ slug: decodeURIComponent(slug) })
  return generateMeta({ doc: stegaCleanDeep(page) })
}
```

### Header and footer

`getCachedGlobal` in `src/utilities/getGlobals.ts` caches with `unstable_cache` and never reads drafts. Bypass the cache in draft mode:

```ts
import { isDraftEnabled, onpageContext } from '@payload-onpage/next'

async function getGlobal<T extends Global>(slug: T, depth = 0, draft = false) {
  const payload = await getPayload({ config: configPromise })
  return payload.findGlobal({
    slug,
    depth,
    draft,
    overrideAccess: true,
    ...(draft ? await onpageContext() : {}),
  })
}

export const getCachedGlobal =
  <T extends Global>(slug: T, depth = 0) =>
  async (): Promise<DataFromGlobalSlug<T>> =>
    (await isDraftEnabled())
      ? getGlobal(slug, depth, true)
      : unstable_cache(async () => getGlobal(slug, depth), [slug], {
          tags: [`global_${slug}`],
        })()
```

`isDraftEnabled()` reads cookies only in draft mode, so visitors still get the cached global.

## 4. The proxy, and the template's own preview

Add the proxy as in [Getting started](../getting-started.md#5-add-the-proxy-required-for-preview-links).

The template's `/next/preview` route (behind **Preview** and **Live Preview** in the admin) turns on Next's draft mode for any signed-in user. On Vercel the proxy is strict by default and doesn't know about that route, so admit its users by verifying their Payload login:

```ts
// src/proxy.ts (Next 16) or src/middleware.ts (Next 15)
import { createOnPageProxy, isPayloadUser } from '@payload-onpage/next/proxy'

const secret = process.env.PAYLOAD_SECRET
export const proxy = createOnPageProxy({
  secret,
  allowDraft: (request) => isPayloadUser(request, { secret }),
})
```

`isPayloadUser` checks the `payload-token` cookie's signature, expiry and collection (`users`) at the edge. Don't use a plain cookie-presence check: the template's pages read drafts with `overrideAccess: draft`, so anyone who set a fake cookie would see every draft.

Live Preview keeps working: payload-onpage's editor stays out of the admin's preview iframe.

## 5. Sections and links

The template wraps every block in `RenderBlocks` with a `<div className="my-16">`, so each section maps to its block without annotations. Text in `CMSLink` maps too: `link.label` is a text field, and `link.url` is skipped because its name looks like a URL.

A section's fields that aren't rendered as text are in its settings panel (**Edit section**). Field conditions apply there as in the admin, so a link shows `url` or `reference` depending on its type. Images (`Media`) map through their `<img>`. Rows you want to select that render no text or image, such as the archive block's, need an annotation: see [Annotations](annotations.md).

## Check

1. In the admin, open a page and press **Edit on page**. Click the hero heading, type, and the dock shows the draft saving.
2. Press **Copy preview link** and open it in a private window. The draft shows with a "Shared preview" bar, and `/posts` shows published content.
3. `curl -s https://your-site/ | grep -c data-onpage` prints `0`.

---

_Found a bug? [Report it](https://github.com/jellologic/payload-onpage/issues/new?template=bug_report.yml) or see [CONTRIBUTING.md](https://github.com/jellologic/payload-onpage/blob/main/CONTRIBUTING.md) to fix it yourself._
