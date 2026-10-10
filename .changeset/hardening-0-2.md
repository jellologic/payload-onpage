---
'@payload-onpage/core': minor
'@payload-onpage/plugin': minor
'@payload-onpage/react': minor
'@payload-onpage/next': minor
'@payload-onpage/lexical': minor
---

Security and architecture release. See docs/upgrading.md for breaking changes.

- Share links never expose Next's draft secret: links and grants are AES-GCM sealed; the (now required) proxy injects draft mode for the shared page only. Links are bound to their document's page, expire after 1 day by default, carry ids for revocation (`validatePreviewLink`).
- Open redirect fixed; enter/mode/exit are same-origin POSTs; access uses Payload's `docAccessOperation` (row-level rules evaluated per document) and defaults to the admin user collection; editor mode is bound to the auth cookie.
- Real stale-write protection (409) via a plugin hook.
- Schema serializer uses Payload's own helpers and translations: system/hidden/virtual/join fields excluded, field permissions respected, `blockReferences` and function defaults supported.
- Editor: serialized publish/discard, retry policy, keyboard editing, focus-managed dialogs, WCAG AA contrast, translatable UI (`messages`), admin strings via Payload i18n.
- Smaller: the rich-text editor loads lazily (Lexical only when a rich-text field opens); visitor cost ~0.3 KB.
- Requires the patched releases: Payload `^3.90.2`, Next `^15.4.11 || ^16.3.8`, Lexical `~0.50.0` (Payload 3.87 and Next 16.3.0 have published security advisories). Works with Next 15's bundled React.
