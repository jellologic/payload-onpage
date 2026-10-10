# Contributing

Thanks for helping! Issues and pull requests are welcome.

## Setup

```bash
bun install
bun run test         # tsc -b for every package, then bun test
bun run dev:example  # example site at http://localhost:3100 (SQLite, seeds itself)
```

`bun run reset` inside `examples/basic` wipes the example database and uploads.

## Layout

| Path | What |
|---|---|
| `packages/core` | Framework-free logic and the port interfaces. No React, no Payload runtime. |
| `packages/plugin` | The Payload plugin (server). |
| `packages/react` | Editor UI, field editors, locators, annotations. |
| `packages/next` | Next.js adapter (session, `<OnPage />`, refresh renderer, proxy). |
| `packages/lexical` | Rich-text field editor. |
| `examples/basic` | Runnable example; also the manual end-to-end test bed. |

## Conventions

- Source imports siblings with explicit `.ts`/`.tsx` extensions. `tsc` rewrites them to `.js`, so `dist/` runs under plain Node (the Payload CLI loads the plugin that way).
- Import Next.js modules as `next/headers.js` or `next/navigation.js`, for the same reason.
- Files that use hooks or the DOM start with `'use client'`. The build keeps one output file per source file, so the directive stays put.
- Add a test with behavior changes: `packages/*/src/__tests__/*.test.ts` (bun test; happy-dom for DOM code).
- Note user-facing changes in `CHANGELOG.md`.

## Releasing

Bump `version` in the changed packages (they're versioned together), update `CHANGELOG.md`, merge to `main`, then run the **Release** workflow. It publishes any version not yet on npm, with provenance.
