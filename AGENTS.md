# AGENTS.md

Guidance for coding agents working **on this repository**. To add payload-onpage to a site, read [docs/getting-started.md](docs/getting-started.md) instead.

## Commands (repo root, Bun)

| Command                             | Does                                                                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `bun install`                       | Install (workspaces: `packages/*`, `examples/*`)                                                                            |
| `bun run check`                     | Everything CI's quality job runs: format, lint, typecheck, tests with coverage gates, build, size budgets                   |
| `bun run test` / `bun run coverage` | Vitest (unit, component, Payload integration), against source                                                               |
| `bun run e2e`                       | Build, then Playwright against `examples/basic` on :3101 with a fresh SQLite DB. Stop any dev server for the example first. |
| `bun run build`                     | `tsc -b` → `packages/*/dist`                                                                                                |
| `bun run dev:example`               | Example site on :3100                                                                                                       |
| `bunx changeset`                    | Describe a user-facing change (required for releases)                                                                       |

## Layout

- `packages/core`: framework-free. Ports (`ports.ts`), session, autosave, markers (`stega.ts`, `encode.ts`), sealing (`seal.ts`), paths (`safePath`). `payload.ts` = REST adapters (`core/payload` entry).
- `packages/plugin`: Payload plugin. `endpoints.ts`, `access.ts` (Payload's `docAccessOperation`), `schema.ts` (serializer on `payload/shared` helpers), `hooks.ts`, `tokens.ts`, `admin/`.
- `packages/react`: `editor/` (shell, field host, ghosts, page events), `ui/` (Dialog, Overlay, Dock, panels), `editors/` (one file each), `messages.ts`, `layout.ts`, `targets.ts`, `locators.ts`, `editor-kit.ts`.
- `packages/lexical`: rich text. `index.ts` stays light (lazy editor); the component and nodes are in `editor.ts`.
- `packages/next`: `session.ts`, `proxy.ts`, `index.tsx` (`<OnPage>`), `client.tsx` (mount), `editor.tsx` (lazy), `refresh.ts`.
- `examples/basic`: the reference integration and the e2e target.

## Invariants (don't break these)

1. **Visitors pay nothing.** No `cookies()`/`headers()` before `draftMode().isEnabled` is true. Annotations return `{}` when disabled. The visitor mount stays under 1.5 KB (`bun run size`).
2. **Markers never persist.** `stripMarkers` runs on `beforeValidate` and `beforeChange`, and only reads with `context.onpage` get markers.
3. **Share-link viewers never receive Next's draft cookie.** Only the proxy injects it, per request, for the sealed path.
4. **Authorization goes through `plugin/src/access.ts`** (Payload's access ops). Never add an endpoint that changes state without `rejectCrossSite` + an access check.
5. **Package boundaries** (lint-enforced): core imports no framework; react imports no Next/Payload; plugin imports no React outside `admin/`.
6. **Sources import siblings with `.ts`/`.tsx` extensions** (rewritten to `.js`). Import Next modules as `next/headers.js` etc. so `dist` runs under plain Node.
7. **Every UI string goes through `t()`** (`messages.ts`). Interactive UI uses `Dialog` (focus handling) and keeps WCAG AA contrast (e2e runs axe).

## Conventions

- Prettier (single quotes, no semicolons, width 100). typescript-eslint type-checked, react-hooks (React Compiler rules), jsx-a11y. `strict` TypeScript.
- Tests: next to the code in `src/__tests__/`. Integration tests use real Payload on SQLite in memory via `handleEndpoints` (see `plugin/src/__tests__/integration.test.ts`). Component tests use Testing Library + happy-dom (`// @vitest-environment happy-dom`).
- Behavior change → test. Security change → an integration test that would fail without it.
- Public API → TSDoc, plus docs in `docs/`.
