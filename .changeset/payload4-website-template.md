---
'@payload-onpage/core': patch
'@payload-onpage/plugin': patch
'@payload-onpage/next': patch
'@payload-onpage/tanstack-start': patch
---

Fixes for Payload's website template and Payload 4:

- **Installs on Payload 4:** the plugin's peer range now accepts `payload@^4.0.0-beta.0`, so `npm install` no longer fails with ERESOLVE on TanStack Start sites.
- **Preview routes:** when `admin.preview` returns a preview route that carries a secret (the website template's `/next/preview?path=…&previewSecret=…`), the plugin uses its `path` and logs a warning. Before, edit and share links pointed at that route: share links got a 403 and carried the secret.
- **Payload 4:** block slugs listed in `blocks` (`blocks: ['cta']`) and upload `variants` are read.
- **Startup warning** for enabled collections or globals without drafts, whose on-page edits go live as they autosave.
- **`isPayloadUser`** (`@payload-onpage/next/proxy`): verifies a Payload login at the edge, for `allowDraft`, so your own preview route and Live Preview keep working behind the strict proxy on Vercel.
- **TanStack Start:** preview-link viewers navigate with full page loads, so each page is checked by the server. Before, a client-side navigation back to the shared page showed published content.
- New guide: [Payload's website template](https://github.com/jellologic/payload-onpage/blob/main/docs/guides/website-template.md).
