/**
 * @payload-onpage/next — payload-onpage for the Next.js App Router.
 *
 *   // payload.config.ts (import from /session: it has no client code)
 *   import { nextSession } from '@payload-onpage/next/session'
 *   plugins: [onpage({ collections: ['pages'], session: nextSession() })]
 *
 *   // app/(frontend)/layout.tsx — renders nothing for visitors
 *   <Suspense><OnPage /></Suspense>
 *
 *   // where the page reads Payload in draft mode
 *   payload.find({ collection: 'pages', draft, ...(await onpageContext()) })
 */
import { cookies } from 'next/headers.js';
import type { ComponentType } from "react";
import { OnPageMount, type OnPageMountProps } from "./client.tsx";
import { getOnPageMode, LINK_COOKIE } from "./session.ts";

export * from "./session.ts";

export interface OnPageProps extends Omit<OnPageMountProps, "mode" | "shared"> {
  /**
   * Your own client mount, to pass client-only options (custom field
   * editors, locator, media library…):
   *
   *   'use client'
   *   export const Mount = (p: OnPageMountProps) => <OnPageMount {...p} editors={{ json: myJsonEditor }} />
   */
  mount?: ComponentType<OnPageMountProps>;
}

/**
 * Mounts the editor (edit mode) or the preview toolbar (preview mode) and
 * renders nothing otherwise. It reads cookies, so wrap it in <Suspense> when
 * the layout is statically rendered.
 */
export async function OnPage({ mount: Mount = OnPageMount, ...props }: OnPageProps) {
  const mode = await getOnPageMode();
  if (!mode) return null;
  const shared = !!(await cookies()).get(LINK_COOKIE)?.value;
  return <Mount {...props} mode={mode} shared={shared} />;
}
