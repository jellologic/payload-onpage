---
'@payload-onpage/core': minor
'@payload-onpage/plugin': minor
'@payload-onpage/react': minor
'@payload-onpage/next': minor
'@payload-onpage/tanstack-start': minor
---

**Comments and review requests** (opt-in: `comments: true`, or `{ guests: true }`):

- **Editors** comment on a page or on the selected section, resolve and reopen comments, and **request a review**. That calls your `onReviewRequest` with a fresh share link to the draft, so you can notify reviewers. Comments are kept in an `onpage-comments` collection the plugin adds (generate a migration).
- **Share-link viewers** (with `guests`) can comment on the page they were sent, quoting selected text. The plugin takes the page from their sealed grant, keeps the text short, and caps comments per link.
- Editors who can't publish see Publish turned off, with a pointer to **Request review**. `DocumentSchema.canPublish` comes from the same check Payload's scheduler makes.

New: plugin endpoints under `/onpage/comments` and `/onpage/review`; `DataSource.listComments`, `addComment`, `resolveComment` and `requestReview`; `PageComment`; `PreviewGrant.id`; and `commentsHref` on `PreviewToolbar`.
