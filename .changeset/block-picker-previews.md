---
'@payload-onpage/core': minor
'@payload-onpage/plugin': minor
'@payload-onpage/react': minor
---

Block picker: shows each block's Payload thumbnail (`admin.images.thumbnail`, or the older `imageURL`) and groups blocks by `admin.group`. On documents rendered in client mode (`<OnPageClient>`), pointing at a block previews it in place on the page before it's added, using optional sample content from `admin.custom.onpage.example`; set `insertExample: true` beside it to start new blocks from that content. New in core: `previewRow()` and the `SchemaImage` type; `SchemaBlock` gains `thumbnail`, `group`, `example` and `insertExample`.
