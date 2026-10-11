# Custom media library

`MediaLibrary` powers the image picker. The default, `payloadUploads()`, searches and uploads to a Payload upload collection.

```ts
import type { MediaLibrary } from '@payload-onpage/core'

export const cloudinaryLibrary = (): MediaLibrary => ({
  async search({ query, page, relationTo, signal }) {
    // `signal` aborts a search the user has moved on from.
    const res = await fetch(
      `/api/my-dam/search?q=${encodeURIComponent(query ?? '')}&page=${page}`,
      { signal },
    )
    const body = await res.json()
    return {
      // `doc` is what gets stored in the field (and rendered in client mode): usually the upload document.
      items: body.results.map((r) => ({
        id: r.payloadId,
        url: r.url,
        thumbnailUrl: r.thumb,
        alt: r.alt,
        doc: r.payloadDoc,
      })),
      hasMore: body.hasMore,
    }
  },
  // Optional: enables "Upload…"
  async upload(file, { relationTo, alt }) {
    /* … */
  },
})
```

Pass it with `<OnPageMount {...p} media={cloudinaryLibrary()} />`. Without a media library, upload fields can't be changed on the page.

---

_Found a bug? [Report it](https://github.com/jellologic/payload-onpage/issues/new?template=bug_report.yml) or see [CONTRIBUTING.md](https://github.com/jellologic/payload-onpage/blob/main/CONTRIBUTING.md) to fix it yourself._
