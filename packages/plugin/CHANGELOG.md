# @payload-onpage/plugin

## 0.4.1

### Patch Changes

- [#16](https://github.com/jellologic/payload-onpage/pull/16) [`32e018c`](https://github.com/jellologic/payload-onpage/commit/32e018c5b2d90491b8d917a452d7ac2147c2964c) Thanks [@jellologic](https://github.com/jellologic)! - Preview links now work on Vercel. Vercel's cache decides whether to bypass a cached page from the cookies the browser itself sends, before any proxy runs, so the draft mode the proxy injected never reached the page: a shared link showed the published page, or a 404 for a page that was never published.

  With `nextSession({ cdnBypass })`, on by default when `process.env.VERCEL` is set, the viewer's browser also gets Next's draft cookie, scoped to the shared page's path and expiring with the link. `withOnPage` now guards that cookie. It strips it from any request the grant doesn't cover. With the new `allowDraft` option it is strict: the cookie survives only on the granted page, for an editor whose bound session is still signed in, or when `allowDraft(request)` says so. Use it to admit your own preview route's admins, and it fails closed if the check throws. Leaving preview clears the page-scoped cookie, so `SessionAdapter.disable()` now receives the page's `path`.

  `@payload-onpage/tanstack-start` is now part of the release.

- Updated dependencies [[`32e018c`](https://github.com/jellologic/payload-onpage/commit/32e018c5b2d90491b8d917a452d7ac2147c2964c)]:
  - @payload-onpage/core@0.4.1

## 0.4.0

### Patch Changes

- [`cfd55ea`](https://github.com/jellologic/payload-onpage/commit/cfd55eaf03184af534fe0fee8ca2e5122d05e5e7) Thanks [@jellologic](https://github.com/jellologic)! - `onpage()` now accepts Payload v3 and v4 configs (it is typed as a generic config passthrough), so the same plugin registers on both the Next.js (Payload 3) and TanStack Start (Payload 4 beta) setups. No behavior change.

- [`cfd55ea`](https://github.com/jellologic/payload-onpage/commit/cfd55eaf03184af534fe0fee8ca2e5122d05e5e7) Thanks [@jellologic](https://github.com/jellologic)! - Security hardening from an adversarial review of the plugin. The editor schema endpoint now returns 403 when collection/global update access is definitively denied (including when an access check throws, which previously served the schema unfiltered); `/mode` requires editing at least one enabled document; the CSRF guard refuses `sec-fetch-site: none`; `enter` and `preview-link` authenticate before parsing refs; the admin new-tab form uses `rel="noopener"`; an empty `secret` option fails at config time; and the marker cleaner drops `__proto__` keys. Removes the unused `SEAL_PURPOSE.editBinding` export.
- Updated dependencies [[`cfd55ea`](https://github.com/jellologic/payload-onpage/commit/cfd55eaf03184af534fe0fee8ca2e5122d05e5e7)]:
  - @payload-onpage/core@0.4.0

## 0.3.2

### Patch Changes

- Updated dependencies []:
  - @payload-onpage/core@0.3.2

## 0.3.1

### Patch Changes

- Updated dependencies []:
  - @payload-onpage/core@0.3.1

## 0.3.0

### Minor Changes

- [#7](https://github.com/jellologic/payload-onpage/pull/7) [`b936774`](https://github.com/jellologic/payload-onpage/commit/b936774c8d7e8371623fc781f9b15b1141a005f1) Thanks [@jellologic](https://github.com/jellologic)! - Stricter types, fewer bugs, more of Payload reused. See docs/upgrading.md for the changes that affect you. For most sites, that's passing `session` and fixing any collection slug typos the compiler now finds.

  - **Fixes:**
    - Text ids that look numeric (and ids past 2^53) no longer open the wrong document.
    - Old Lexical links keep an id after editing.
    - The media adapter honours custom `init` headers.
    - Preview grants without an expiry are refused.
    - Admin strings and labels are translated.
    - Dialogs keep outside clicks.
    - The settings panel opens a field's custom editor.
    - Path segments that reach the prototype are refused.
  - **Payload reuse:**
    - Endpoints throw Payload's errors.
    - `req.searchParams`, `req.locale` and `localeCodes` replace hand-rolled parsing.
    - URLs come from `formatAdminURL` (basePath-aware), translations from `deepMergeSimple`.
    - Hooks use Payload's hook types; options use `CollectionSlug`/`GlobalSlug`, and `RequestContext` is augmented.
    - The serializer switches over Payload's own field union, and the redundant row-level access query is gone.
  - **Types:**
    - `SchemaField` is a discriminated union, with `FieldOf`.
    - `defineEditor({ accepts, normalize })` types editors by field kind.
    - `t()` checks keys and their variables.
    - `RefKey`/`TargetKey` type document keys, and `isReady()` narrows document state.
    - `SaveResult` is a union.
    - The compiler runs with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `verbatimModuleSyntax`.
  - **Structure:**
    - One field walker, shared row rules (`rowOps`) and named geometry.
    - Editors share `EditorPopover`/`ApplyBar`/`useDraft`.
    - The editor context is split into a stable API and changing state.
    - Searches are abortable, and core's public API is explicit.

### Patch Changes

- Updated dependencies [[`b936774`](https://github.com/jellologic/payload-onpage/commit/b936774c8d7e8371623fc781f9b15b1141a005f1)]:
  - @payload-onpage/core@0.3.0

## 0.2.1

### Patch Changes

- [#5](https://github.com/jellologic/payload-onpage/pull/5) [`c620bb6`](https://github.com/jellologic/payload-onpage/commit/c620bb6bae277c2d8ff089f0e2b91f337ca5af92) Thanks [@jellologic](https://github.com/jellologic)! - Fix 0.2.0's internal dependencies: its packages depended on each other at 0.1.0, so installs mixed 0.2.0 and 0.1.0 code. 0.2.1 pins every `@payload-onpage/*` dependency to the same version.
- Updated dependencies [[`c620bb6`](https://github.com/jellologic/payload-onpage/commit/c620bb6bae277c2d8ff089f0e2b91f337ca5af92)]:
  - @payload-onpage/core@0.2.1

## 0.2.0

### Minor Changes

- [#1](https://github.com/jellologic/payload-onpage/pull/1) [`2add437`](https://github.com/jellologic/payload-onpage/commit/2add4377ffb7b20a8b2f84ba0d6c97f90b405df3) Thanks [@jellologic](https://github.com/jellologic)! - Security and architecture release. See docs/upgrading.md for breaking changes.

  - Share links never expose Next's draft secret: links and grants are AES-GCM sealed; the (now required) proxy injects draft mode for the shared page only. Links are bound to their document's page, expire after 1 day by default, carry ids for revocation (`validatePreviewLink`).
  - Open redirect fixed; enter/mode/exit are same-origin POSTs; access uses Payload's `docAccessOperation` (row-level rules evaluated per document) and defaults to the admin user collection; editor mode is bound to the auth cookie.
  - Real stale-write protection (409) via a plugin hook.
  - Schema serializer uses Payload's own helpers and translations: system/hidden/virtual/join fields excluded, field permissions respected, `blockReferences` and function defaults supported.
  - Editor: serialized publish/discard, retry policy, keyboard editing, focus-managed dialogs, WCAG AA contrast, translatable UI (`messages`), admin strings via Payload i18n.
  - Smaller: the rich-text editor loads lazily (Lexical only when a rich-text field opens); visitor cost ~0.3 KB.
  - Requires the patched releases: Payload `^3.90.2`, Next `^15.4.11 || ^16.3.8`, Lexical `~0.50.0` (Payload 3.87 and Next 16.3.0 have published security advisories). Works with Next 15's bundled React.

### Patch Changes

- Updated dependencies [[`2add437`](https://github.com/jellologic/payload-onpage/commit/2add4377ffb7b20a8b2f84ba0d6c97f90b405df3)]:
  - @payload-onpage/core@0.2.0
