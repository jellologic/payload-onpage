# Modes

| Mode           | Who                  | What they see                                            | Turned on by                                              |
| -------------- | -------------------- | -------------------------------------------------------- | --------------------------------------------------------- |
| **Edit**       | Signed-in editors    | Draft + editing tools                                    | Admin **Edit on page**, or the preview toolbar's **Edit** |
| **Preview**    | Signed-in editors    | Draft without tools, plus device widths                  | The dock's **Preview**                                    |
| **Share link** | Anyone with the link | Draft of **one page**, read-only, until the link expires | A preview link (`/api/onpage/preview?token=…`)            |

- Edit and preview turn on Next draft mode site-wide for that editor. The mode cookie is bound to their auth cookie, so signing out or switching user ends it. It lasts 12 hours by default (`nextSession({ maxAge })`).
- Share links never give the browser Next's draft secret. The proxy injects draft mode for the shared path only, until the sealed grant expires. See [security](security.md).
- **Exit** clears everything (`POST /api/onpage/exit`).

![Previewing a draft at phone and tablet widths, then returning to editing](../media/preview.gif)

A share link shows one page's draft, read-only, to anyone with the link:

![A shared preview: the draft page with a "Shared preview" toolbar](../media/shared-preview.png)

## Rendering

|                   | Refresh mode (default)                                                                       | Client mode                                                               |
| ----------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| How               | Save, then `router.refresh()`                                                                | The page renders from editor state                                        |
| Setup             | Nothing                                                                                      | Wrap the document in `<OnPageClient>` ([guide](../guides/client-mode.md)) |
| Feels             | Instant: the new text stays on screen as a "ghost" until the server render lands (about 1 s) | Instant, including layout changes                                         |
| Server components | Yes                                                                                          | The rendered tree must be client-renderable                               |

Both can be used on one page: client-mode documents skip the refresh.
