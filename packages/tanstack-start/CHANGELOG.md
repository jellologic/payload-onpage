# @payload-onpage/tanstack-start

## 0.5.0

### Patch Changes

- Updated dependencies [[`9dca50e`](https://github.com/jellologic/payload-onpage/commit/9dca50e72997076f2e39a5b02cf635171786dd0c)]:
  - @payload-onpage/core@0.5.0
  - @payload-onpage/react@0.5.0
  - @payload-onpage/lexical@0.5.0

## 0.4.1

### Patch Changes

- Updated dependencies [[`32e018c`](https://github.com/jellologic/payload-onpage/commit/32e018c5b2d90491b8d917a452d7ac2147c2964c)]:
  - @payload-onpage/core@0.4.1
  - @payload-onpage/lexical@0.4.1
  - @payload-onpage/react@0.4.1

## 0.4.0

### Minor Changes

- [`cfd55ea`](https://github.com/jellologic/payload-onpage/commit/cfd55eaf03184af534fe0fee8ca2e5122d05e5e7) Thanks [@jellologic](https://github.com/jellologic)! - New package: day-one TanStack Start support, alongside Next.js. The editor UI is the same components behind a different framework adapter: `tanstackSession({ secret })` for `payload.config.ts`, `<OnPage />` for the frontend layout route, and `isDraftEnabled()` / `onpageContext()` for server functions and loaders. Refresh after save goes through `router.invalidate()`.

  There is no proxy step on Start: request middleware cannot rewrite the request, so page reads verify the sealed preview grant directly (unseal + path + expiry) with the session secret. Without the secret, preview links fail closed to published content. See `docs/getting-started-tanstack.md` and the `examples/tanstack` demo.

  Version requirements (Payload 4 is in beta — pin these): `payload` + `@payloadcms/*` at `4.0.0-beta.0`, `@tanstack/react-start` `1.168.60`, `@tanstack/react-router` `1.170.41`, `react` 19, `lexical` 0.52. Next.js sites stay on Payload 3 (`@payload-onpage/next` is unchanged). Full matrix: `docs/compatibility.md`.

### Patch Changes

- Updated dependencies [[`cfd55ea`](https://github.com/jellologic/payload-onpage/commit/cfd55eaf03184af534fe0fee8ca2e5122d05e5e7), [`cfd55ea`](https://github.com/jellologic/payload-onpage/commit/cfd55eaf03184af534fe0fee8ca2e5122d05e5e7)]:
  - @payload-onpage/lexical@0.4.0
  - @payload-onpage/core@0.4.0
  - @payload-onpage/react@0.4.0
