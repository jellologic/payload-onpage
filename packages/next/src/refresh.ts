'use client'

/**
 * The Next.js Renderer: after a save, re-render the current route on the
 * server (router.refresh) inside a transition. `afterSave` resolves once the
 * new render is on screen, so the editor knows when to drop its stand-ins.
 * Saves landing close together share one refresh.
 */
import { useEffect, useMemo, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation.js'
import type { Renderer } from '@payload-onpage/core'

const DEBOUNCE = 60
const FALLBACK = 10_000

export function useNextRefresh(): Renderer {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const queued = useRef<Array<() => void>>([])
  const inFlight = useRef<Array<() => void>>([])
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (pending || !inFlight.current.length) return
    const done = inFlight.current
    inFlight.current = []
    done.forEach((f) => f())
  }, [pending])

  return useMemo<Renderer>(
    () => ({
      name: 'next-refresh',
      live: false,
      afterSave: () =>
        new Promise<void>((resolve) => {
          queued.current.push(resolve)
          setTimeout(resolve, FALLBACK) // never hang the editor on a refresh that didn't report back
          clearTimeout(timer.current)
          timer.current = setTimeout(() => {
            inFlight.current.push(...queued.current)
            queued.current = []
            startTransition(() => router.refresh())
          }, DEBOUNCE)
        }),
    }),
    [router],
  )
}
