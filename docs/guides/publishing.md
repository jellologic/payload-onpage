# Page settings and publishing

## Page settings

**Page settings** in the dock shows each document's own fields that aren't on the page: SEO meta, dates, relationships, selects and toggles. It's generated from your schema like a section's settings. Fields shown on the page are edited there instead, and `slug` is left out because changing it would move the page under the editor.

Narrow what's offered with the plugin's `fields` option per collection, or with field access.

## Publish

**Publish** publishes every document on the page that has unpublished changes: edits made here, or drafts saved earlier. Documents without changes are skipped.

**▾** beside it opens the publish menu, where you choose which documents to publish. For example, publish the page but not a header edit that isn't ready.

## Schedule

For collections and globals with scheduled publishing on, the publish menu can schedule them for later:

```ts
versions: { drafts: { autosave: true, schedulePublish: true } },
```

Payload then publishes each document's **latest saved draft** at that time, through the same `schedulePublish` job the admin uses. Two things to know:

- **Scheduled jobs need Payload's job queue to run:** `jobs.autoRun` in the config, or a cron calling `/api/payload-jobs/run`. See [Payload's jobs docs](https://payloadcms.com/docs/jobs-queue/overview).
- **Who can schedule:** the same users who can publish the document. The check is the one Payload's scheduler makes: update access for `_status: 'published'`.

Edits made after scheduling are included, since the job publishes the draft as it is then. See or cancel scheduled publishes in the admin's document view.

A custom `DataSource` offers scheduling by implementing `schedulePublish(ref, { at, type, locale })`.

---

_Found a bug? [Report it](https://github.com/jellologic/payload-onpage/issues/new?template=bug_report.yml) or see [CONTRIBUTING.md](https://github.com/jellologic/payload-onpage/blob/main/CONTRIBUTING.md) to fix it yourself._
