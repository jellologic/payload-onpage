# Compatibility

|                      | Supported                                                           | Tested in CI                             |
| -------------------- | ------------------------------------------------------------------- | ---------------------------------------- |
| Payload              | `^3.90.2` (earlier 3.x releases have published security advisories) | 3.90                                     |
| Next.js (App Router) | `^15.4.11 \|\| ^16.3.8` (patched releases within Payload's range)   | 15.4, 16.4                               |
| React                | `^19.0.0`                                                           | 19.2, and the React bundled with Next 15 |
| Node.js              | `>=20.9`                                                            | 20, 22, 24                               |
| Lexical              | `~0.50.0` (matches Payload 3.90's `@payloadcms/richtext-lexical`)   | 0.50                                     |
| Databases            | Any Payload adapter: the plugin uses Payload's API only             | SQLite (tests, example)                  |

**Next 15 vs 16:** the proxy file is `middleware.ts` (export `middleware`) on 15 and `proxy.ts` (export `proxy`) on 16. Everything else is identical.

**Pages Router:** not supported. The session adapter and refresh renderer target the App Router. The ports allow other adapters.
