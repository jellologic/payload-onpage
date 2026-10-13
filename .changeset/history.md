---
'@payload-onpage/core': minor
'@payload-onpage/react': minor
---

- **History** in the dock: a document's saved versions. **Outline what changed since published** marks every changed field on the page; **Restore** makes an older version the current draft (it isn't published). New: `DataSource.listVersions` and `restoreVersion` (implemented by `payloadRest`), `EditorSession.restoreVersion`, `changedPaths()`, `VersionSummary`.
- Documents without drafts say so in the dock ("Header: changes go live").
