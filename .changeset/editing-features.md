---
'@payload-onpage/core': minor
'@payload-onpage/plugin': minor
'@payload-onpage/react': minor
'@payload-onpage/lexical': minor
---

Editing:

- **Drag and drop:** sections and list items have a drag handle on their toolbar; drop them anywhere in their list, side by side or stacked. The move buttons and ⌥↑/⌥↓ stay as the keyboard path.
- **Lists in settings:** a list the page doesn't show (a hero's links, a card's tags) is edited in the section's settings: add, edit, move and remove its rows.
- **Links to pages** in rich text: the link popover offers **Page** next to **Web address**. You search the site's pages (the collections enabled for on-page editing, `DocumentSchema.linkTargets`), and the link is stored as Payload's internal link (`linkType: 'internal'`, `doc`).
