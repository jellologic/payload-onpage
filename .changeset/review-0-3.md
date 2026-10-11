---
'@payload-onpage/core': minor
'@payload-onpage/react': minor
'@payload-onpage/lexical': minor
'@payload-onpage/plugin': minor
'@payload-onpage/next': minor
---

Stricter types, fewer bugs, more of Payload reused. See docs/upgrading.md for the changes that affect you. For most sites, that's passing `session` and fixing any collection slug typos the compiler now finds.

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
