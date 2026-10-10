/**
 * The editor hub: a tiny module-level store holding the mounted editor, so
 * components anywhere on the page (client-mode documents, custom UI) can reach
 * it without being rendered inside it. That keeps `<OnPage />` a sibling in the
 * layout, not a wrapper, which matters for static/PPR rendering.
 */
import type { OnPageContextValue } from './context.tsx'

let current: OnPageContextValue | null = null
const listeners = new Set<() => void>()

export const hub = {
  get: (): OnPageContextValue | null => current,
  set(value: OnPageContextValue | null) {
    if (value === current) return
    current = value
    for (const fn of listeners) fn()
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
}
