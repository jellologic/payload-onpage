---
'@payload-onpage/core': patch
'@payload-onpage/plugin': patch
'@payload-onpage/next': patch
'@payload-onpage/tanstack-start': patch
---

Hardening:

- **Secret rotation:** `secret` (plugin, proxy, `tanstackSession`) also takes a keyring, `[newSecret, oldSecret]`. The first seals, any of them unseals, so open preview links and edit sessions survive a rotation. See [Rotating the secret](https://github.com/jellologic/payload-onpage/blob/main/docs/concepts/security.md#rotating-the-secret).
- **TanStack Start:** when `isDraftEnabled()` returns true, the response is marked `Cache-Control: private, no-store`, so no shared cache keeps a draft.
- The plugin logs a warning when an editor enters edit mode without the auth cookie it binds to (header or API-key auth, a renamed cookie), since signing out then wouldn't end edit mode.
- Docs: a recipe for revoking preview links by id, and why the path field should be `unique`.
