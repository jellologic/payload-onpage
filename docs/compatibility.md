# Compatibility

|                      | Supported                                                    | Tested in CI            |
| -------------------- | ------------------------------------------------------------ | ----------------------- |
| Payload              | `^3.87.0`                                                    | 3.87                    |
| Next.js (App Router) | `^15.4.11 \|\| ^16.2.6` (Payload's own range)                | 15.4, 16                |
| React                | `^19.2.0`                                                    | 19.2                    |
| Node.js              | `>=20.9`                                                     | 20, 22, 24              |
| Lexical              | `~0.41.0` (matches Payload's `@payloadcms/richtext-lexical`) | 0.41                    |
| Databases            | Any Payload adapter: the plugin uses Payload's API only      | SQLite (tests, example) |

**Next 15 vs 16:** the proxy file is `middleware.ts` (export `middleware`) on 15 and `proxy.ts` (export `proxy`) on 16. Everything else is identical.

**Pages Router:** not supported. The session adapter and refresh renderer target the App Router. The ports allow other adapters.
