---
'@payload-onpage/tanstack-start': minor
---

New package: day-one TanStack Start support, alongside Next.js. The editor UI is the same components behind a different framework adapter: `tanstackSession({ secret })` for `payload.config.ts`, `<OnPage />` for the frontend layout route, and `isDraftEnabled()` / `onpageContext()` for server functions and loaders. Refresh after save goes through `router.invalidate()`.

There is no proxy step on Start: request middleware cannot rewrite the request, so page reads verify the sealed preview grant directly (unseal + path + expiry) with the session secret. Without the secret, preview links fail closed to published content. See `docs/getting-started-tanstack.md` and the `examples/tanstack` demo.

Version requirements (Payload 4 is in beta — pin these): `payload` + `@payloadcms/*` at `4.0.0-beta.0`, `@tanstack/react-start` `1.168.60`, `@tanstack/react-router` `1.170.41`, `react` 19, `lexical` 0.52. Next.js sites stay on Payload 3 (`@payload-onpage/next` is unchanged). Full matrix: `docs/compatibility.md`.
