# Caching, static pages and PPR

- **Visitors are unaffected.** `<OnPage />`, `isDraftEnabled()`, `getOnPageMode()` and `onpageContext()` read `draftMode().isEnabled` first and touch cookies only when draft mode is on. Next exempts that read from prerender bailout, so static and PPR pages stay static.
- **Editors and link viewers get dynamic renders.** Draft-mode requests bypass the static cache, so edits and drafts always render fresh.
- **Share links on static pages work.** The proxy injects draft mode into the request before Next decides how to serve it.
- **Reads that feed the page** should pass `draft` and `...onpageContext()`. Anything cached with `unstable_cache` or `'use cache'` must not be shared between draft and published reads: key it by draft, or skip the cache when `draft` is true.
- **Revalidation after publish** is your site's existing mechanism (Payload `afterChange` hooks calling `revalidatePath`/`revalidateTag`). Publishing from the page is a normal Payload update, so those hooks run.
