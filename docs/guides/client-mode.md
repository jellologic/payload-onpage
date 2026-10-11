# Client mode

In client mode the page renders a document from the editor's state, so every change shows immediately: typing, adding rows, picking images. There's no server round trip.

```tsx
'use client' // the render prop is a function, so this must be a client component
import { OnPageClient } from '@payload-onpage/react/client'
import { PageView } from './PageView'

export function LivePage({ page }) {
  return (
    <OnPageClient
      collection="pages"
      doc={page}
      render={(doc, e) => <PageView page={doc} e={e} />}
    />
  )
}
```

- Outside the editor it renders `doc` as given, with inert annotations. It costs about 1.7 KB.
- Inside the editor it adopts the page's value, then renders editor state. Text is auto-mapped (markers re-applied); `autoMap={false}` turns that off.
- `e` is the document's annotation helper (see [annotations](annotations.md)).
- The rendered tree must be client-renderable. Async server components can't be inside `render`.
- Saves use the collection's autosave interval. The page doesn't wait for them.

Example: [`InstantPage.tsx`](../../examples/basic/src/components/InstantPage.tsx) (`/about` in the example).

---

_Found a bug? [Report it](https://github.com/jellologic/payload-onpage/issues/new?template=bug_report.yml) or see [CONTRIBUTING.md](https://github.com/jellologic/payload-onpage/blob/main/CONTRIBUTING.md) to fix it yourself._
