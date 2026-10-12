---
'@payload-onpage/next': patch
'@payload-onpage/core': patch
'@payload-onpage/plugin': patch
---

Preview links now work on Vercel. Vercel's cache decides whether to bypass a cached page from the cookies the browser itself sends, before any proxy runs, so the draft mode the proxy injected never reached the page: a shared link showed the published page, or a 404 for a page that was never published.

With `nextSession({ cdnBypass })`, on by default when `process.env.VERCEL` is set, the viewer's browser also gets Next's draft cookie, scoped to the shared page's path and expiring with the link. `withOnPage` now guards that cookie. It strips it from any request the grant doesn't cover. With the new `allowDraft` option it is strict: the cookie survives only on the granted page, for an editor whose bound session is still signed in, or when `allowDraft(request)` says so. Use it to admit your own preview route's admins, and it fails closed if the check throws. Leaving preview clears the page-scoped cookie, so `SessionAdapter.disable()` now receives the page's `path`.

`@payload-onpage/tanstack-start` is now part of the release.
