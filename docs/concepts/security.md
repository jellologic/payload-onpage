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
onpage({
  collections: ['pages'],
  session: nextSession(),
  access: ({ req, ref }) => req.user?.roles?.includes('editor') ?? false,
})
```

Fields the user can't update are left out of the editor schema (field-level access).

## Preview links

- **Token:** AES-256-GCM, sealed with a key derived (HKDF) from `PAYLOAD_SECRET` or the `secret` option, holding `{ ref, path, locale, iat, exp, jti }`. It's opaque to the holder. Default lifetime is 1 day (`previewLinkTTL`).
- **Bound:** the path is computed on the server. On open, the link must still match the document's page (a moved or deleted document invalidates it).
- **Revocation:** `validatePreviewLink({ req, ref, path, issuedAt, id })` lets you deny by `jti` or issue time. Rotating the secret revokes every link. There is no built-in throttle on minting links — put token-minting and state-changing endpoints behind infrastructure rate limiting.
- **Known limit:** the path check happens when the link opens. If a document moves to another path in the same instant a viewer opens an old link, the grant (which binds the path, not the document) could show the new occupant's draft. The window is milliseconds and needs an editor-timed move; binding page reads to the grant's document id was considered and rejected — reads don't know which document the page is rendering.
- **Opening a link** stores only a sealed grant cookie. On Next.js, the proxy unseals it per request and injects Next's draft cookie into the forwarded request on the shared path only; on TanStack Start there is no proxy — page reads unseal the grant and check path + expiry themselves. Either way, copying cookies to other paths, or forging a draft credential, gets nothing.
- **The proxy is required** for share links on Next.js. Without it, links fail closed: viewers see published content. (On Start, the session's `secret` plays the same role: without it, grants never validate.)

## Cookies

| Cookie               | Holder                                      | Flags                                                                                                                                                                                                                                                              |
| -------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `onpage`             | Editors                                     | httpOnly, SameSite=Lax, Secure on HTTPS, 12 h. Value `edit:<authCookie>:<hash>.<seal>`: bound to the session and sealed, so it can't be hand-made. The Next proxy and Start reads verify the seal.                                                                 |
| `onpage_preview`     | Share-link viewers                          | httpOnly, SameSite=Lax, Secure on HTTPS, expires with the link. Sealed.                                                                                                                                                                                            |
| `onpage_hint`        | Editors, viewers (Start)                    | Readable by the mount, trusted by nothing. Lets visitors skip the state lookup entirely.                                                                                                                                                                           |
| `__prerender_bypass` | Editors (Next.js); viewers with `cdnBypass` | Next's own, one key for the whole site until the next deploy. Viewers get it only with `cdnBypass` (default on Vercel), scoped to the shared page and the link's lifetime. On Vercel the proxy is strict by default, so a copied cookie unlocks nothing elsewhere. |

Set `serverURL` in production. It's used for redirects, link URLs and the Secure flag; the plugin warns at startup when it's missing.

Payload's dev `autoLogin` also authenticates API requests (as the seeded user) — convenient for the examples, never for production. Test anonymous behavior with `DisableAutologin: true` (see the schema e2e test).

## Reporting

See [SECURITY.md](../../SECURITY.md).

---

_Found a bug? [Report it](https://github.com/jellologic/payload-onpage/issues/new?template=bug_report.yml) or see [CONTRIBUTING.md](https://github.com/jellologic/payload-onpage/blob/main/CONTRIBUTING.md) to fix it yourself._
