---
'@payload-onpage/core': patch
'@payload-onpage/plugin': patch
'@payload-onpage/next': patch
'@payload-onpage/tanstack-start': patch
---

Security: the editor's `onpage` mode cookie is now sealed with the plugin secret, so it can't be hand-made.

- **TanStack Start:** a visitor could set `onpage=view` (or a forged session binding) and see every draft. Reads now verify the seal, and fail closed without `tanstackSession({ secret })`.
- **Next.js:** a forged binding no longer gets past `allowDraft`, and the proxy strips mode cookies whose seal doesn't verify. On Vercel (`cdnBypass`), the proxy is now strict by default: a copied draft cookie only works on the page its preview link covers, or for a signed-in editor. If your own preview route enables draft mode on Vercel, admit its users with `allowDraft`.
- The documented proxy matcher now skips assets by extension only, so page paths with dots (`/blog/release-2.0`) are guarded too.
- Markers are stripped before your own `beforeValidate`/`beforeChange` hooks run, and fields with `admin.readOnly` are no longer editable on the page.

Editors in edit mode when you upgrade must press **Edit on page** again. Custom `SessionAdapter`s should store `createModeCookie(mode, { sealMode, … })` from the new `sealMode` option of `enable()`.
