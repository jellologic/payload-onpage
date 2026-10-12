# payload-onpage documentation

On-page editing and draft previews for **Payload CMS**, on **Next.js (App Router)** and **TanStack Start**.

| Start here                                                         |                                                                        |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| [Tour](tour.md)                                                    | What editors see, in screenshots and short clips                       |
| [Getting started](getting-started.md)                              | Install and wire it into a Next.js site (three steps + the proxy)      |
| [Getting started with TanStack Start](getting-started-tanstack.md) | Install and wire it into a TanStack Start site (three steps, no proxy) |
| [Compatibility](compatibility.md)                                  | Supported Payload, Next.js, TanStack Start, React and Node versions    |
| [Troubleshooting](troubleshooting.md)                              | The usual suspects, with fixes                                         |

**Concepts**

- [Architecture](concepts/architecture.md): packages, ports, and what happens from "Edit on page" to a saved change.
- [Auto-mapping](concepts/auto-mapping.md): how page text maps back to fields without annotations.
- [Modes](concepts/modes.md): edit, preview and share links; refresh vs client rendering.
- [Security](concepts/security.md): the threat model, access, cookies, preview links, CSRF.

**Guides**

- [Payload's website template](guides/website-template.md): adding payload-onpage to `create-payload-app -t website`.
- [With Payload's plugins](guides/plugins.md): SEO, nested docs, redirects, search, form builder, multi-tenant, storage adapters.
- [Annotations](guides/annotations.md): precise mapping for rows, lists, images and non-text fields.
- [Page settings, history and publishing](guides/publishing.md): SEO and other page fields, versions and restore, choosing what to publish, scheduling.
- [Several editors](guides/collaboration.md): document locks, conflicts and invalid fields.
- [Logging and error reporting](guides/events.md): `onEvent`, with a Sentry recipe.
- [Client mode](guides/client-mode.md): instant edits without a server round trip.
- [Block thumbnails and previews](guides/block-picker.md): thumbnails in the section picker, and live previews in client mode.
- [Globals and multiple documents](guides/globals-and-multiple-documents.md)
- [Custom field editor](guides/custom-field-editor.md)
- [Custom data source](guides/custom-data-source.md)
- [Custom media library](guides/custom-media-library.md)
- [Localization](guides/localization.md): content locales and editor UI strings.
- [Caching, static pages and PPR](guides/caching-and-ppr.md)

**Reference**: `bun run docs:api` generates the API reference (TypeDoc) into `docs/api/`. Every export carries TSDoc.

Upgrading from 0.1? See [upgrading](upgrading.md). Working on this repository? See [AGENTS.md](../AGENTS.md) and [CONTRIBUTING.md](../CONTRIBUTING.md).

---

_Found a bug? [Report it](https://github.com/jellologic/payload-onpage/issues/new?template=bug_report.yml) or see [CONTRIBUTING.md](https://github.com/jellologic/payload-onpage/blob/main/CONTRIBUTING.md) to fix it yourself._
