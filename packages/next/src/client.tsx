'use client'

/**
 * Client side of the Next adapter. `OnPageMount` is tiny: the editor itself
 * is loaded only when someone is editing or previewing.
 */
import dynamic from 'next/dynamic.js'
import type { DataSource, Locator, MediaLibrary } from '@payload-onpage/core'
import type { FieldEditorDef, Messages } from '@payload-onpage/react'

export interface OnPageMountProps {
  mode: 'edit' | 'view'
  /** Opened from a shared preview link (no editing). */
  shared?: boolean
  /** Payload API route. Default "/api". */
  apiRoute?: string
  /** Plugin endpoint prefix. Default "/onpage". */
  prefix?: string
  /** Payload admin route. Default "/admin". */
  adminRoute?: string
  /** Locale to edit. Default: <html lang>. */
  locale?: string
  // Client-only options (pass them from your own 'use client' mount):
  editors?: Record<string, FieldEditorDef | null>
  locator?: Locator
  media?: MediaLibrary
  dataSource?: DataSource
  /** Override editor UI strings (see `defaultMessages` in @payload-onpage/react). */
  messages?: Messages
}

const Editor = dynamic(() => import('./editor.tsx').then((m) => m.NextEditor), { ssr: false })
const Preview = dynamic(() => import('./editor.tsx').then((m) => m.NextPreview), { ssr: false })

export function OnPageMount(props: OnPageMountProps) {
  return props.mode === 'edit' ? <Editor {...props} /> : <Preview {...props} />
}

export { OnPageClient } from '@payload-onpage/react/client'
export { useNextRefresh } from './refresh.ts'
