/** Framework-free Renderer adapters. Next.js's router.refresh() renderer lives in @payload-onpage/next. */
import type { Renderer } from "@payload-onpage/core";

/** The page renders from editor state (OnPageClient everywhere): nothing to do after a save. */
export const clientState = (): Renderer => ({ name: "client", live: true, afterSave() {} });

/** Reload the whole page after each save. A last resort for frameworks without a soft refresh. */
export const fullReload = (): Renderer => ({
  name: "reload",
  live: false,
  afterSave() {
    window.location.reload();
    return new Promise(() => {}); // never resolves: the page goes away
  },
});
