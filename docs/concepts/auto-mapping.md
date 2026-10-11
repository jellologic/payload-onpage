# Auto-mapping

In edit mode, every displayable string a page reads carries an **invisible marker**: zero-width characters encoding `{ document, field path, kind }`. The editor scans the rendered DOM for markers and knows, with no annotations, that this `<h2>` is `layout.2.heading` of page 12.

## What gets marked

- `text` and `textarea` values
- rich-text text nodes (mapped to the rich-text field as a whole)
- the `alt` of populated uploads, carrying the **upload field's** path, so `<img alt>` maps the image

Never marked:

- selects, numbers, dates, checkboxes, relationships, JSON, code
- fields whose name has a machine-like segment: `url`, `href`, `link`, `path`, `email`, `phone`, `slug`, `key`, `token`, `anchor`, `id`, `class`, `style`, `icon`, `color`, `hex`. Matching is by camelCase or snake segment, so `ctaUrl` is skipped but `lifestyleTitle` isn't.
- fields with a non-text editor (`admin.custom.onpage.editor: 'color'`)

Narrow it further with the plugin's `encode` option:

```ts
onpage({
  collections: ['pages'],
  session: nextSession(),
  encode: ({ field, path }) => !path.startsWith('seo.'),
})
```

## Lifecycle

1. `onpageContext()` returns `{ context: { onpage: true } }` in edit mode only. Payload passes it to hooks.
2. The plugin's `afterRead` hook marks strings only for reads with that context. REST, admin and GraphQL reads stay clean.
3. `beforeValidate`/`beforeChange` hooks strip markers from **every** write, so markers can't be stored.
4. In the browser, the `stega()` locator maps text nodes and `img[alt]`, and infers rows and lists from where their fields render.

## Caveats

- **Strings change in edit mode.** Comparing or slicing a marked string (`title === 'Home'`, `title.slice(0, 20)`) behaves differently. Use `stegaClean(value)` from `@payload-onpage/core`, or annotate that element instead.
- **Strings used as identifiers** (CSS classes, keys, ids) should come from fields that aren't marked; see the list above.
- **Rows** are inferred when their fields render inside a common wrapper. For exact rows, or rows without text, use [annotations](../guides/annotations.md).

---

_Found a bug? [Report it](https://github.com/jellologic/payload-onpage/issues/new?template=bug_report.yml) or see [CONTRIBUTING.md](https://github.com/jellologic/payload-onpage/blob/main/CONTRIBUTING.md) to fix it yourself._
