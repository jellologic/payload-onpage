# Upgrading

## Versioning in 0.x

All `@payload-onpage/*` packages are released together, at the same version. Until 1.0:

- **Minor** (0.5 → 0.6) may change public APIs. Each change is listed here with what to do.
- **Patch** (0.5.0 → 0.5.1) fixes bugs and security issues. It doesn't change APIs you call. It can still add an option, tighten a check (a security fix), or ask editors to re-enter edit mode.
- **Public API** is what each package's entry points export and the docs describe: the plugin options, framework helpers, ports (`DataSource`, `SessionAdapter`, …), and `@payload-onpage/core`'s explicit export list. Anything else, such as CSS classes and `data-*` attributes other than the documented `data-testid`s, may change in any release.

Keep all `@payload-onpage/*` packages on the same version.

## 0.5.0 → 0.5.1

A security release. No code changes for most sites.

| Change                                                                                                                                                         | What to do                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The editor's `onpage` mode cookie is sealed with the plugin secret. Mode cookies set by 0.5.0 aren't accepted                                                  | Editors press **Edit on page** again once after the upgrade                                                                                                |
| TanStack Start: reads verify that seal with `tanstackSession({ secret })`, and show no drafts without it                                                       | Make sure `tanstackSession({ secret })` gets the plugin's secret (Payload's `secret` by default)                                                           |
| Next.js on Vercel: the proxy is strict by default. A draft cookie is kept only on a preview link's page, or for an editor who entered through **Edit on page** | If your own preview route turns on draft mode (Payload's website template does), pass `allowDraft: (request) => isPayloadUser(request, { secret })`        |
| The documented proxy matcher changed, so page paths with dots are guarded                                                                                      | Copy the new matcher from [Getting started](getting-started.md#5-add-the-proxy-required-for-preview-links)                                                 |
| `SessionAdapter.enable(mode, opts)` receives `opts.sealMode`                                                                                                   | Custom adapters only: store `await createModeCookie(mode, { sealMode, expiresAt, bindTo, token })`, and read with `readModeCookie(raw, getCookie, secret)` |
| Fields with `admin.readOnly` are no longer editable on the page. Field access is evaluated against the document being edited                                   | Nothing                                                                                                                                                    |
| `secret` can be a keyring, `[new, old]`                                                                                                                        | Optional: see [Rotating the secret](concepts/security.md#rotating-the-secret)                                                                              |
| The plugin's peer range accepts Payload 4 betas                                                                                                                | Nothing                                                                                                                                                    |

## 0.4 → 0.5

| Change                                                                                                      | What to do                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| The block picker shows Payload's block thumbnails and groups, and previews blocks in place in client mode   | Nothing. Optionally add `admin.images.thumbnail` and sample content: see [Block thumbnails and previews](guides/block-picker.md) |
| `SchemaBlock` gains optional `thumbnail`, `group`, `example` and `insertExample`; core exports `previewRow` | Custom data sources that build schemas themselves may fill them in                                                               |

## 0.3 → 0.4

| Change                                                                                                                                                              | What to do                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| The schema endpoint answers 403 when update access is definitively denied, or when an access check throws                                                           | Nothing, unless an access function throws on purpose                                              |
| `/mode` requires the user to be able to edit at least one enabled document                                                                                          | Nothing                                                                                           |
| The CSRF guard refuses `sec-fetch-site: none` (a request no page started, such as one from a bookmark)                                                              | Use the built-in buttons                                                                          |
| An empty `secret` option fails when the config is built                                                                                                             | Omit `secret` to use Payload's                                                                    |
| `SEAL_PURPOSE.editBinding` removed                                                                                                                                  | Nothing (it was unused)                                                                           |
| 0.4.1: preview links on Vercel. `nextSession({ cdnBypass })`, on by default on Vercel, and the proxy's `allowDraft`. `SessionAdapter.disable()` receives `{ path }` | Custom session adapters: accept `disable({ path })`, and clear any credential scoped to that path |

## 0.2 → 0.3

0.3 makes the compiler catch more mistakes and fixes several bugs. Most sites only notice the first two rows.

| Change                                                                                                                                                      | What to do                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session` is **required**: without it, `onpage()` throws `InvalidConfiguration` when the config is built, not on the first request                          | Pass `session: nextSession()` (or your own `SessionAdapter`)                                                                                                                                                          |
| `collections` / `globals` keys are checked against your generated `CollectionSlug` / `GlobalSlug`                                                           | A typo is now a compile error. Without generated types, any string is accepted                                                                                                                                        |
| `routePrefix` must start with `/` (a `` `/${string}` `` type)                                                                                               | Nothing, unless you set one without a leading slash                                                                                                                                                                   |
| Custom field editors: use `defineEditor({ mode, accepts, normalize?, component })`                                                                          | Plain `{ mode, component }` objects still work and accept any field. With `accepts`, props are typed (`FieldEditorProps<NumberField, number \| null>`), and the registry never hands the editor another kind of field |
| `SchemaField` is a union discriminated on `type` (`ScalarField`, `NumberField`, `ChoiceField`, `RelationField`, `GroupField`, `ArrayField`, `BlocksField`…) | Check `field.type` before reading kind-specific properties (`options`, `relationTo`, `fields`, `blocks`, `min`…)                                                                                                      |
| `t(key, vars)` accepts only message keys, and requires exactly the variables a message uses                                                                 | Show raw text without `t`                                                                                                                                                                                             |
| `notify(text, bad?)` takes already-translated text                                                                                                          | `notify(t('notify.published'))` instead of `notify('notify.published')`                                                                                                                                               |
| `useOnPageOptional()` returns the editor's API (no `snap`). New: `useOnPageApi()`, `useSessionSnapshot(session)`                                            | Read documents with `useSessionSnapshot(api?.session)`. `useOnPage()` is unchanged                                                                                                                                    |
| `SaveResult` is a union: `{ ok: true, updatedAt? }` or `{ ok: false, status, message? }`                                                                    | Custom data sources: return a `status` with every failure (0 for a network error)                                                                                                                                     |
| `DataSource.search` and `MediaLibrary.search` receive a `signal`                                                                                            | Pass it to `fetch`, so superseded searches are cancelled. `useDebouncedSearch(search)` no longer takes `deps`; its search gets `(query, page, signal)`                                                                |
| `getAt()` returns `unknown`                                                                                                                                 | Narrow the result (`Array.isArray`, `typeof`)                                                                                                                                                                         |
| Document keys are typed `RefKey` (`` `c:${string}:${string}` \| `g:${string}` ``)                                                                           | Build them with `refKey(ref)`                                                                                                                                                                                         |
| Fewer exports from `@payload-onpage/core`: internal helpers (the field walker, `collectionRef`, …) are no longer public                                     | Everything documented is still exported                                                                                                                                                                               |
| The schema endpoint and preview-link endpoint answer errors in Payload's format (`{ errors: [{ message }] }`)                                               | Nothing, unless you parsed their old `{ error }` body yourself                                                                                                                                                        |
| The mode endpoint answers 403 (not 401) to a signed-in user who isn't allowed                                                                               | Nothing                                                                                                                                                                                                               |

**Fixed:**

- **Wrong document opened:** text ids that look numeric (`"007"`) and ids past 2^53 opened the wrong document. The server now uses the collection's id type.
- **Lexical links without an id:** old Payload Lexical links (versions 1 and 2) got no id after an edit.
- **Custom auth on media:** the media adapter ignored `init` headers.
- **Translations:** the admin "link copied" message and translated collection labels are now translated.
- **Dialogs:** the popover dialog could miss an outside click while typing.
- **Settings panel:** the panel ignored a field's custom editor (e.g. `color`).

## 0.1 → 0.2

0.2 is a security and architecture release. Breaking changes:

| Change                                                                                                                                                       | What to do                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **The proxy is required for share links** and has a new API: `createOnPageProxy({ secret })`, or `withOnPage(request, { secret })` in an existing middleware | Replace `export { onpageProxy as proxy }` with `export const proxy = createOnPageProxy({ secret: process.env.PAYLOAD_SECRET })` |
| `enter`, `mode` and `exit` are same-origin **POST** endpoints                                                                                                | Use the built-in buttons. Custom links must become forms (`<form method="post" action=…>`).                                     |
| `access({ req, ref })`: `ref` is undefined for "may use on-page editing"                                                                                     | Handle `ref === undefined`                                                                                                      |
| Default preview-link lifetime is 1 day (was 7)                                                                                                               | Set `previewLinkTTL` if you need longer                                                                                         |
| `/api/onpage/search` removed                                                                                                                                 | Relationship search uses Payload REST; nothing to do unless you called it                                                       |
| Payload REST adapters moved to `@payload-onpage/core/payload`                                                                                                | `import { payloadRest, payloadUploads } from '@payload-onpage/core/payload'`                                                    |
| `@payload-onpage/lexical` main entry no longer exports the component or nodes                                                                                | Import them from `@payload-onpage/lexical/editor`                                                                               |
| `SessionAdapter` gained `enableLink()`; `Links.previewLink` → `DataSource.createPreviewLink`                                                                 | Custom adapters only                                                                                                            |
| `<OnPageEditor media>` has no default                                                                                                                        | The Next adapter passes `payloadUploads()`. Pass a `MediaLibrary` if you mount `OnPageEditor` yourself.                         |
| Peers: Payload `^3.90.2`, Next `^15.4.11 \|\| ^16.3.8`, Lexical `~0.50.0` (security releases)                                                                | Upgrade Payload, Next and Lexical together                                                                                      |

---

_Found a bug? [Report it](https://github.com/jellologic/payload-onpage/issues/new?template=bug_report.yml) or see [CONTRIBUTING.md](https://github.com/jellologic/payload-onpage/blob/main/CONTRIBUTING.md) to fix it yourself._
