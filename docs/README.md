# payload-onpage documentation

On-page editing and draft previews for **Payload CMS 3 + Next.js (App Router)**.

| Start here                            |                                                                     |
| ------------------------------------- | ------------------------------------------------------------------- |
| [Tour](tour.md)                       | What editors see, in screenshots and short clips                    |
| [Getting started](getting-started.md) | Install and wire it into an existing site (three steps + the proxy) |
| [Compatibility](compatibility.md)     | Supported Payload, Next.js, React and Node versions                 |
| [Troubleshooting](troubleshooting.md) | The usual suspects, with fixes                                      |

**Concepts**

- [Architecture](concepts/architecture.md): packages, ports, and what happens from "Edit on page" to a saved change.
- [Auto-mapping](concepts/auto-mapping.md): how page text maps back to fields without annotations.
- [Modes](concepts/modes.md): edit, preview and share links; refresh vs client rendering.
- [Security](concepts/security.md): the threat model, access, cookies, preview links, CSRF.

**Guides**

- [Annotations](guides/annotations.md): precise mapping for rows, lists, images and non-text fields.
- [Client mode](guides/client-mode.md): instant edits without a server round trip.
- [Globals and multiple documents](guides/globals-and-multiple-documents.md)
- [Custom field editor](guides/custom-field-editor.md)
- [Custom data source](guides/custom-data-source.md)
- [Custom media library](guides/custom-media-library.md)
- [Localization](guides/localization.md): content locales and editor UI strings.
- [Caching, static pages and PPR](guides/caching-and-ppr.md)

**Reference**: `bun run docs:api` generates the API reference (TypeDoc) into `docs/api/`. Every export carries TSDoc.

Upgrading from 0.1? See [upgrading](upgrading.md). Working on this repository? See [AGENTS.md](../AGENTS.md) and [CONTRIBUTING.md](../CONTRIBUTING.md).
