# Contributing

Thanks for helping! Issues and pull requests are welcome. Agents: [AGENTS.md](AGENTS.md) has the same information in checklist form.

## Setup

```bash
bun install
bun run check        # format, lint, types, tests + coverage gates, build, size budgets
bun run e2e          # Playwright against examples/basic (fresh SQLite DB, port 3101)
bun run dev:example  # example site on :3100
```

`bun run reset` inside `examples/basic` wipes the example database and uploads.

## Workflow

1. Branch from `main`.
2. Make the change, with tests:
   - unit or component tests in `src/__tests__/`
   - Payload integration tests for endpoint, access or hook changes
   - e2e for user-visible flows
3. `bunx changeset` for anything user-facing (all packages are versioned together).
4. `bun run check` and `bun run e2e` pass.
5. Open a PR. CI also runs Node 20/22/24 smoke imports, Next 15/16 example builds, CodeQL and dependency review.

## Standards

- TypeScript `strict`; no `any` outside tests; typescript-eslint type-checked rules, react-hooks (React Compiler rules), jsx-a11y.
- Prettier: single quotes, no semicolons, width 100 (Payload's style).
- Package boundaries are lint-enforced. See the layout in [AGENTS.md](AGENTS.md).
- Sources import siblings with `.ts`/`.tsx` extensions, and Next modules as `next/headers.js`, so `dist` runs under plain Node.
- UI strings go through `t()`. Dialogs use `Dialog`. Keep WCAG AA contrast (e2e runs axe).
- Public API: TSDoc, plus docs in `docs/`. After changing docs, run `bun run docs:llms` (CI checks `llms-full.txt` is current).

## Releasing

Merging to `main` makes Changesets open a "Version packages" PR. **Merging that PR releases automatically**: `release.yml` runs `bun run check`, dry-runs every package, publishes them to npm with provenance through npm trusted publishing (no token is stored), and creates the GitHub Release `v<version>` from the changelog. Each package trusts `jellologic/payload-onpage`, workflow `release.yml`, environment `npm`; the `npm` environment deploys only from `main`. If a release is interrupted, re-run the workflow ("Run workflow"): versions already on npm are skipped.
