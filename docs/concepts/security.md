# Security

## Threat model (summary)

| Asset              | Threat                                       | Mitigation                                                                                                                                     |
| ------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Unpublished drafts | Anonymous or low-privilege users read drafts | Draft mode only via authenticated endpoints. Share links are sealed, path-bound and expiring, and the browser never holds Next's draft secret. |
| Document integrity | Editing documents a user may not edit        | Every write is Payload REST (Payload enforces access). Entry points use Payload's `docAccessOperation`, including row-level `where` rules.     |
| Editor sessions    | CSRF that switches modes or opens editing    | State-changing endpoints are same-origin `POST`s (Origin / `Sec-Fetch-Site`). Preview-link creation needs JSON.                                |
| Visitors           | Open redirect via `?path=`                   | `safePath()` rejects anything that could resolve off-site, including control characters, backslashes and encoded forms.                        |
| Stored content     | Marker or script injection                   | Markers are stripped on every write. Rich-text links reject `javascript:`/`data:`. Ghost HTML is sanitized.                                    |
| Concurrent edits   | Silent overwrites                            | Stale-write guard: the editor sends `x-onpage-if-unmodified-since`, and the plugin answers 409 if the document changed.                        |

## Who can edit

Default: users of `config.admin.user`, with the document's own `update` access, evaluated by Payload. That includes access functions that return a query: "editors may update their own pages" works per document.

Replace it entirely with the `access` option. `ref` is undefined for "may use on-page editing at all":

```ts
onpage({ access: ({ req, ref }) => req.user?.roles?.includes('editor') ?? false })
```

Fields the user can't update are left out of the editor schema (field-level access).

## Preview links

- **Token:** AES-256-GCM, sealed with a key derived (HKDF) from `PAYLOAD_SECRET` or the `secret` option, holding `{ ref, path, locale, iat, exp, jti }`. It's opaque to the holder. Default lifetime is 1 day (`previewLinkTTL`).
- **Bound:** the path is computed on the server. On open, the link must still match the document's page (a moved or deleted document invalidates it).
- **Revocation:** `validatePreviewLink({ req, ref, path, issuedAt, id })` lets you deny by `jti` or issue time. Rotating the secret revokes every link.
- **Opening a link** stores only a sealed grant cookie. The proxy unseals it per request and injects Next's draft cookie into the forwarded request on the shared path only. Copying cookies to other paths, or forging Next's draft cookie, gets nothing.
- **The proxy is required** for share links. Without it, links fail closed: viewers see published content.

## Cookies

| Cookie               | Holder                 | Flags                                                                                                   |
| -------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------- |
| `onpage`             | Editors                | httpOnly, SameSite=Lax, Secure on HTTPS, 12 h. Value `edit:<authCookie>:<hash>` (bound to the session). |
| `onpage_preview`     | Share-link viewers     | httpOnly, SameSite=Lax, Secure on HTTPS, expires with the link. Sealed.                                 |
| `__prerender_bypass` | Editors only (Next.js) | Next's own. Never given to share-link viewers.                                                          |

Set `serverURL` in production. It's used for redirects, link URLs and the Secure flag; the plugin warns at startup when it's missing.

## Reporting

See [SECURITY.md](../../SECURITY.md).
