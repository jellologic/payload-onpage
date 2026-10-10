'use client'

import { createContext, useContext, useSyncExternalStore } from 'react'
import { hub } from './hub.ts'
import type { OnPageContextValue } from './types.ts'

export const OnPageContext = createContext<OnPageContextValue | null>(null)

/** The editor, for code rendered inside it (field editors, panels). */
export function useOnPage(): OnPageContextValue {
  const ctx = useContext(OnPageContext)
  if (!ctx) throw new Error('useOnPage must be used inside <OnPageEditor>')
  return ctx
}

const getNull = () => null

/** The editor, from inside it or anywhere on the page; null when no editor is mounted (public pages). */
export function useOnPageOptional(): OnPageContextValue | null {
  const inside = useContext(OnPageContext)
  const outside = useSyncExternalStore(hub.subscribe, hub.get, getNull)
  return inside ?? outside
}
