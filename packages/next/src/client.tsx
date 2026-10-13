'use client'

/**
 * Client side of the Next adapter. `OnPageMount` is tiny: the editor itself
 * is loaded only when someone is editing or previewing.
 */
import dynamic from 'next/dynamic.js'
import type { DataSource, Locator, MediaLibrary, OnPageMode } from '@payload-onpage/core'
import type { FieldEditorDef, Messages } from '@payload-onpage/react'

export interface OnPageMountProps {
  mode: OnPageMode
  /** Opened from a shared preview link (no editing). */
  shared?: boolean | undefined
  /** Payload API route. Default "/api". */
  apiRoute?: string | undefined
  /** Plugin endpoint prefix. Default "/onpage". */
  prefix?: `/${string}` | undefined
  /** Payload admin route. Default "/admin". */
  adminRoute?: string | undefined
  /** Locale to edit. Default: <html lang>. */
  locale?: string | undefined
  // Client-only options (pass them from your own 'use client' mount):
  editors?: Record<string, FieldEditorDef | null> | undefined
  locator?: Locator | undefined
  media?: MediaLibrary | undefined
  dataSource?: DataSource | undefined
  /** Override editor UI strings (see `defaultMessages` in @payload-onpage/react). */
  messages?: Messages | undefined
  /** The language of `messages`, for plurals, dates and times in the editor UI. Default "en". */
  uiLocale?: string | undefined
}

const Editor = dynamic(() => import('./editor.tsx').then((m) => m.NextEditor), { ssr: false })
const Preview = dynamic(() => import('./editor.tsx').then((m) => m.NextPreview), { ssr: false })

export function OnPageMount(props: OnPageMountProps) {
  return props.mode === 'edit' ? <Editor {...props} /> : <Preview {...props} />
}

export { OnPageClient } from '@payload-onpage/react/client'
export { useNextRefresh } from './refresh.ts'
