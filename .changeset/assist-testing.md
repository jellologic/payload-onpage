---
'@payload-onpage/core': minor
'@payload-onpage/react': minor
'@payload-onpage/next': minor
'@payload-onpage/tanstack-start': minor
---

- **Writing assistant** (`assist`, an `AssistPort` you implement; no AI vendor is bundled): **✨** on text fields offers Shorter, Clearer, Friendlier, Fix spelling, or your own instruction. The answer replaces the text, still uncommitted. Pass it from your client mount. The examples include a signed-in-only endpoint that uses Claude when `ANTHROPIC_API_KEY` is set.
- **`@payload-onpage/core/testing`:** `memoryDataSource()`, an in-memory `DataSource` for testing custom editors and pages. It applies saves, checks for stale writes, and records saves.
