# Upgrading

## 0.1 → 0.2

0.2 is a security and architecture release. Breaking changes:

| Change                                                                                                                                                       | What to do                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **The proxy is required for share links** and has a new API: `createOnPageProxy({ secret })`, or `withOnPage(request, { secret })` in an existing middleware | Replace `export { onpageProxy as proxy }` with `export const proxy = createOnPageProxy({ secret: process.env.PAYLOAD_SECRET })` |
| `enter`, `mode` and `exit` are same-origin **POST** endpoints                                                                                                | Use the built-in buttons. Custom links must become forms (`<form method="post" action=…>`).                                     |
| `access({ req, ref })`: `ref` is undefined for "may use on-page editing"                                                                                     | Handle `ref === undefined`                                                                                                      |
| Default preview-link lifetime is 1 day (was 7)                                                                                                               | Set `previewLinkTTL` if you need longer                                                                                         |
| `/api/onpage/search` removed                                                                                                                                 | Relationship search uses Payload REST; nothing to do unless you called it                                                       |
| Payload REST adapters moved to `@payload-onpage/core/payload`                                                                                                | `import { payloadRest, payloadUploads } from '@payload-onpage/core/payload'`                                                    |
| `@payload-onpage/lexical` main entry no longer exports the component or nodes                                                                                | Import them from `@payload-onpage/lexical/editor`                                                                               |
| `SessionAdapter` gained `enableLink()`; `Links.previewLink` → `DataSource.createPreviewLink`                                                                 | Custom adapters only                                                                                                            |
| `<OnPageEditor media>` has no default                                                                                                                        | The Next adapter passes `payloadUploads()`. Pass a `MediaLibrary` if you mount `OnPageEditor` yourself.                         |
| Peers: Payload `^3.90.2`, Next `^15.4.11 \|\| ^16.3.8`, Lexical `~0.50.0` (security releases)                                                                | Upgrade Payload, Next and Lexical together                                                                                      |
