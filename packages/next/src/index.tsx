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
import type { ComponentType } from 'react'
import { OnPageMount, type OnPageMountProps } from './client.tsx'
import { getOnPageMode, isSharedPreview } from './session.ts'

export * from './session.ts'

/** Client-only options can't cross the server/client boundary; pass them from your own `mount`. */
type ClientOnly = 'mode' | 'shared' | 'editors' | 'locator' | 'media' | 'dataSource'

export interface OnPageProps extends Omit<OnPageMountProps, ClientOnly> {
  /**
   * Your own client mount, to pass client-only options (custom field
   * editors, locator, media library…):
   *
   *   'use client'
   *   export const Mount = (p: OnPageMountProps) => <OnPageMount {...p} editors={{ json: myJsonEditor }} />
   */
  mount?: ComponentType<OnPageMountProps>
}

/**
 * Mounts the editor (edit mode) or the preview toolbar (preview mode) and
 * renders nothing otherwise. Static-safe: it reads cookies only in draft mode.
 */
export async function OnPage({ mount: Mount = OnPageMount, ...props }: OnPageProps) {
  const mode = await getOnPageMode()
  if (!mode) return null
  return <Mount {...props} mode={mode} shared={await isSharedPreview()} />
}
