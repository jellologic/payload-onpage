# @payload-onpage/react

## 0.4.1

### Patch Changes

- Updated dependencies [[`32e018c`](https://github.com/jellologic/payload-onpage/commit/32e018c5b2d90491b8d917a452d7ac2147c2964c)]:
  - @payload-onpage/core@0.4.1

## 0.4.0

### Patch Changes

- Updated dependencies [[`cfd55ea`](https://github.com/jellologic/payload-onpage/commit/cfd55eaf03184af534fe0fee8ca2e5122d05e5e7)]:
  - @payload-onpage/core@0.4.0

## 0.3.2

### Patch Changes

- [#12](https://github.com/jellologic/payload-onpage/pull/12) [`3f4bc61`](https://github.com/jellologic/payload-onpage/commit/3f4bc6152629b2a684c8604bfafd1f771e810b72) Thanks [@jellologic](https://github.com/jellologic)! - - **Dock position:** a new `--po-dock-bottom` CSS variable (default `16px`) raises the dock above a site's own fixed bottom bar. The preview toolbar, the locale notice and the pinned "+ Add" button follow it.
  - **Icons:** the dock, section toolbar, dialogs and rich-text toolbar now use SVG icons (undo, redo, move, duplicate, settings, close) instead of text glyphs, which rendered tiny and unevenly in some fonts.
- Updated dependencies []:
  - @payload-onpage/core@0.3.2

## 0.3.1

### Patch Changes

- [#9](https://github.com/jellologic/payload-onpage/pull/9) [`c44ca24`](https://github.com/jellologic/payload-onpage/commit/c44ca24c6b137d665a3526606c9fce34c38a46c9) Thanks [@jellologic](https://github.com/jellologic)! - The dock, the preview toolbar and the locale notice no longer wrap at half the window width. These centred bars were capped at 50% of the viewport, which pushed **Publish** onto a second row on ordinary laptop screens.
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
