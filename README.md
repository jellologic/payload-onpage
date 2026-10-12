# payload-onpage

[![CI](https://github.com/jellologic/payload-onpage/actions/workflows/ci.yml/badge.svg)](https://github.com/jellologic/payload-onpage/actions/workflows/ci.yml) [![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**On-page editing and draft previews for Payload CMS, on Next.js (App Router) and TanStack Start.** Editors click the text, images and sections they see on the live page and change them in place. Edits autosave as Payload drafts through Payload's own REST API, so access control, hooks, validation, drafts and versions behave exactly as in the admin. Anyone can preview a draft from a signed, expiring link that opens one page only.

_The visual, WYSIWYG inline editor for Payload CMS: live draft preview, click-to-edit text and sections, and signed share links — a front-end editing layer that writes back through Payload's own API._

- **Drop-in:** four edits to an existing site, and no component changes. Text maps to its fields automatically.
- **Any collection or global**, and several documents on one page with one undo history.
- **Add sections visually:** the block picker shows your blocks' Payload thumbnails, and in client mode previews a section in place before you add it.
- **Built-in field editors:** text, rich text (Lexical), images, select, date, number, relationship, color. Replace any of them, or add your own.
- **Ports and adapters:** data source, media library, locator, renderer, session and field editors are all swappable.
- **Fast:** visitors load about 0.3 KB, and the editor (about 29 KB gz) loads only for editors.
- **Accessible:** keyboard editing, managed focus and WCAG AA contrast, checked with axe in CI.
- **Secure by design:** Payload's own access checks, CSRF-safe endpoints, a stale-write guard, and share links that never expose Next's draft secret.

![Editing a Payload CMS page in place: click the heading on the Next.js page, type, and the change autosaves as a draft](docs/media/edit-text.gif)

## See it

| Rearrange and add sections                                                                              | Preview on any device                                                                     |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| ![Moving a section and adding one from the block picker](docs/media/sections.gif)                       | ![Previewing the draft at phone and tablet widths](docs/media/preview.gif)                |
| **Section settings from your block fields**                                                             | **Rich text (Payload Lexical), inline**                                                   |
| ![The settings panel for a section: a URL field and a Light/Dark choice](docs/media/settings-panel.png) | ![Inline Lexical rich-text editing with a formatting toolbar](docs/media/rich-text.png)   |
| **Share a read-only draft link**                                                                        | **Start from the Payload admin**                                                          |
| ![A shared preview link showing the draft with a Shared preview toolbar](docs/media/shared-preview.png) | ![Edit on page and Copy preview link in the Payload admin](docs/media/admin-controls.png) |

More in the **[tour](docs/tour.md)**.

## Try it

```bash
git clone https://github.com/jellologic/payload-onpage && cd payload-onpage
bun install && bun run dev:example     # http://localhost:3100 — SQLite, seeds itself, signs you in
```

Open http://localhost:3100/admin, open the Home page, and press **Edit on page**.

## Add it to your site

```bash
npm i @payload-onpage/plugin @payload-onpage/next @payload-onpage/react @payload-onpage/core @payload-onpage/lexical
```

```ts
// payload.config.ts
import { onpage } from '@payload-onpage/plugin'
import { nextSession } from '@payload-onpage/next/session'

plugins: [onpage({ collections: ['pages'], globals: ['header'], session: nextSession() })]
```

```tsx
// app/(frontend)/layout.tsx
<Suspense fallback={null}>
  <OnPage />
</Suspense>
```

```ts
// wherever pages read Payload
const draft = await isDraftEnabled()
const page = await payload.find({ collection: 'pages', where, draft, ...(await onpageContext()) })
```

```ts
// proxy.ts (Next 16) / middleware.ts (Next 15): needed for share links
export const proxy = createOnPageProxy({ secret: process.env.PAYLOAD_SECRET })
```

The full walkthrough, with checks after every step and a prompt for coding agents, is in **[Getting started](docs/getting-started.md)** (Next.js) or **[Getting started with TanStack Start](docs/getting-started-tanstack.md)**. Version requirements per framework are in **[Compatibility](docs/compatibility.md)**.

## Documentation

|                                            |                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Tour](docs/tour.md)                       | What editors see, in screenshots and clips                                                                                                                                                                                                                                                                                                                |
| [Getting started](docs/getting-started.md) | Installation, step by step                                                                                                                                                                                                                                                                                                                                |
| [Concepts](docs/README.md)                 | [Architecture](docs/concepts/architecture.md) · [Auto-mapping](docs/concepts/auto-mapping.md) · [Modes](docs/concepts/modes.md) · [Security](docs/concepts/security.md)                                                                                                                                                                                   |
| [Guides](docs/README.md)                   | [Annotations](docs/guides/annotations.md) · [Client mode](docs/guides/client-mode.md) · [Block picker](docs/guides/block-picker.md) · [Custom field editor](docs/guides/custom-field-editor.md) · [Custom data source](docs/guides/custom-data-source.md) · [Localization](docs/guides/localization.md) · [Caching & PPR](docs/guides/caching-and-ppr.md) |
| Reference                                  | [Compatibility](docs/compatibility.md) · [Troubleshooting](docs/troubleshooting.md) · [Upgrading](docs/upgrading.md) · API reference: `bun run docs:api`                                                                                                                                                                                                  |
| For LLMs                                   | [llms.txt](llms.txt) · [llms-full.txt](llms-full.txt) · [AGENTS.md](AGENTS.md) (working on this repo)                                                                                                                                                                                                                                                     |

## Packages

| Package                                                     |                                                                            |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| [`@payload-onpage/plugin`](packages/plugin)                 | Payload plugin: endpoints, access, schema, hooks, admin controls           |
| [`@payload-onpage/next`](packages/next)                     | Next.js adapter: `<OnPage />`, session, refresh renderer, proxy            |
| [`@payload-onpage/tanstack-start`](packages/tanstack-start) | TanStack Start adapter: `<OnPage />`, session, refresh renderer (no proxy) |
| [`@payload-onpage/react`](packages/react)                   | Editor UI, field editors, annotations, client mode                         |
| [`@payload-onpage/core`](packages/core)                     | Framework-free logic and the port interfaces                               |
| [`@payload-onpage/lexical`](packages/lexical)               | Inline rich-text editing for Payload's Lexical JSON                        |

## Contributing

Issues and pull requests are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md) (setup: `bun install && bun run check`); agents should read [AGENTS.md](AGENTS.md). Newcomers: look for [`good first issue`](https://github.com/jellologic/payload-onpage/labels/good%20first%20issue). Report security issues privately ([SECURITY.md](SECURITY.md)).

## License

MIT

---

_Found a bug? [Report it](https://github.com/jellologic/payload-onpage/issues/new?template=bug_report.yml) or see [CONTRIBUTING.md](https://github.com/jellologic/payload-onpage/blob/main/CONTRIBUTING.md) to fix it yourself._
