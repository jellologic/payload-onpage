/**
 * The editor hub: a module-level store holding the mounted editor, so
 * components anywhere on the page (client-mode documents, custom UI) can reach
 * it without being rendered inside it. That keeps `<OnPage />` a sibling in the
 * layout, not a wrapper. Kept on `globalThis` so two copies of the package
 * (a bundling mistake) still share one editor.
 */
import type { OnPageContextValue } from './types.ts'

interface Hub {
  current: OnPageContextValue | null
  listeners: Set<() => void>
}

const KEY = Symbol.for('payload-onpage.hub')
const store: Hub = ((globalThis as Record<symbol, Hub | undefined>)[KEY] ??= {
  current: null,
  listeners: new Set(),
})

export const hub = {
  get: (): OnPageContextValue | null => store.current,
  set: (value: OnPageContextValue | null): void => {
    if (value === store.current) return
    store.current = value
    for (const fn of store.listeners) fn()
  },
  subscribe: (fn: () => void): (() => void) => {
    store.listeners.add(fn)
    return () => store.listeners.delete(fn)
  },
}
