---
'@payload-onpage/core': minor
'@payload-onpage/plugin': minor
'@payload-onpage/react': minor
---

Field conditions (`admin.condition`) apply in section and page settings, as in the admin. The plugin runs them on the server against the document as the editor has it, through `POST /onpage/conditions`, so a link shows `url` or `reference` depending on its type. New: `DataSource.hiddenFields`, and `DocumentSchema.conditions`.
