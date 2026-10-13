---
'@payload-onpage/core': minor
'@payload-onpage/plugin': minor
'@payload-onpage/react': minor
---

- **New pages from the page:** **Duplicate this page** and **New page** in Page settings create a draft at a unique address made from its title, and open it in edit mode. Payload checks the editor's create access. New plugin endpoint `POST /onpage/pages`, and `DataSource.duplicatePage` / `createPage`.
- **Saved sections** (opt-in: `patterns: true`): **Save this section** on a section's toolbar keeps its content under a name in an `onpage-patterns` collection. It's listed under **Saved sections** in the block picker, inserted as a copy with fresh row ids, and previewed in client mode. New: `DataSource.listPatterns` / `savePattern`, `SavedSection`, `DocumentSchema.patterns`.
