# Compatibility

|                      | Supported                                                                                      | Tested in CI                             |
| -------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Payload (Next.js)    | `^3.90.2` (earlier 3.x releases have published security advisories)                            | 3.90                                     |
| Payload (Start)      | `4.0.0-beta.0` (beta: pin it; TanStack support needs Payload 4's `@payloadcms/tanstack-start`) | 4.0.0-beta.0                             |
| Next.js (App Router) | `^15.4.11 \|\| ^16.3.8` (patched releases within Payload's range)                              | 15.4, 16.4                               |
| TanStack Start       | `@tanstack/react-start` `1.168.60` + `@tanstack/react-router` `1.170.41` (beta-era pins)       | 1.168.60 / 1.170.41 (+ example build)    |
| React                | `^19.0.0`                                                                                      | 19.2, and the React bundled with Next 15 |
| Node.js              | `>=20.9`                                                                                       | 20, 22, 24                               |
| Lexical (Next.js)    | `~0.50.0` (matches Payload 3.90's `@payloadcms/richtext-lexical`)                              | 0.50                                     |
| Lexical (Start)      | `~0.52.0` (matches Payload 4 beta's `@payloadcms/richtext-lexical`)                            | 0.52                                     |
| Databases            | Any Payload adapter: the plugin uses Payload's API only                                        | SQLite (tests, examples)                 |

Both frameworks run the same e2e suite in CI (`basic` on Next.js, `tanstack` on Start).

**Next 15 vs 16:** the proxy file is `middleware.ts` (export `middleware`) on 15 and `proxy.ts` (export `proxy`) on 16. Everything else is identical.

**Start + Payload 3:** not supported. The Start adapter and its session read path target Payload 4.

**Pages Router:** not supported. The session adapter and refresh renderer target the App Router. The ports allow other adapters.

---

_Found a bug? [Report it](https://github.com/jellologic/payload-onpage/issues/new?template=bug_report.yml) or see [CONTRIBUTING.md](https://github.com/jellologic/payload-onpage/blob/main/CONTRIBUTING.md) to fix it yourself._
