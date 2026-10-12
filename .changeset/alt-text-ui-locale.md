---
'@payload-onpage/core': minor
'@payload-onpage/react': minor
'@payload-onpage/next': minor
'@payload-onpage/tanstack-start': minor
---

Editor UI:

- **Alt text:** uploading an image asks for its alt text first; it used to be taken from the filename ("IMG 2034"). The current image's alt text can be changed in the image editor; it's saved on the media document. New optional `MediaLibrary.updateAlt`, implemented by `payloadUploads()`.
- **`uiLocale`** (on `<OnPage>`, `OnPageEditor` and `PreviewToolbar`): the language of your `messages`. Plurals, relative times and dates follow it rather than the browser's language. Default `"en"`.
- **Plural forms:** a message with `{count}` can have a form per plural category, such as `'dock.documents.one'`.
- **Shortcut hints** match the platform: `⌘Z` on Apple devices, `Ctrl+Z` elsewhere. `row.delete` now takes an `{undo}` variable.
