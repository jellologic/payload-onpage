---
'@payload-onpage/core': minor
'@payload-onpage/plugin': minor
'@payload-onpage/react': minor
'@payload-onpage/next': minor
'@payload-onpage/tanstack-start': minor
---

Working with others:

- **Document locks:** the editor holds Payload's document lock while editing, so admin users see the page is being edited. The dock says who else holds a lock ("Ada is editing this Page"). New plugin endpoint `POST /onpage/lock` and `DataSource.lock`.
- **Keep my changes** on a conflict: loads the latest version and re-applies your unsaved changes field by field (`EditorSession.keepMine`). Before, the only choice was to reload and lose them.
- **Invalid fields:** a failed save or publish keeps every field Payload's validation error names (`SaveResult.fields`, `PublishResult.fields`, `DocumentState.invalid`) and outlines them on the page.
- **`onEvent`** on the editor and the client mounts: saves, failures, conflicts, publishes, scheduling and errors, for logging or error reporting (`OnPageEvent`). Errors no longer go only to the console.
