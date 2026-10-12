---
'@payload-onpage/core': minor
'@payload-onpage/plugin': minor
'@payload-onpage/react': minor
'@payload-onpage/next': minor
'@payload-onpage/tanstack-start': minor
---

- **Page settings:** a dock button that lists the page's own fields that aren't on it (SEO meta, dates, references, toggles). It uses the same generator as section settings.
- **Publish menu** (**▾** beside Publish): choose which of the page's documents to publish, or schedule them for collections with `versions.drafts.schedulePublish`. Scheduling queues Payload's own `schedulePublish` job through a new plugin endpoint, `POST /onpage/schedule`, which checks publish permission as Payload's scheduler does. New: `DataSource.schedulePublish`, `DocumentSchema.schedulePublish`, `EditorSession.hasUnpublished()`.
- **Smaller first download:** the block picker, settings panels and publish menu now load on first use, prefetched when the browser is idle.
