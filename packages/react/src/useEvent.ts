'use client'

import { useCallback, useInsertionEffect, useRef } from 'react'

/**
 * A stable function that always calls the latest `fn` (the `useEffectEvent`
 * pattern). Our own, because the React bundled with Next.js 15 doesn't export
 * `useEffectEvent`. Call it from effects and event handlers, not during render.
 */
export function useEvent<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const latest = useRef(fn)
  useInsertionEffect(() => {
    latest.current = fn
  })
  return useCallback((...args: A) => latest.current(...args), [])
}
