/**
 * Keeps an index of the page's targets current: scans with the locator on
 * mount and again whenever the page's DOM changes (a server refresh, a client
 * re-render, lazy content), ignoring the editor's own UI.
 */
import { useEffect, useState } from 'react'
import { refKey, type Locator, type Target } from '@payload-onpage/core'
import type { TargetIndex } from './context.tsx'
import { ATTR } from './annotations.ts'
import { UI } from './dom.ts'

const ORDER: Record<string, number> = { annotation: 0 }

export function buildIndex(all: Target[]): TargetIndex {
  const byEl = new Map<Element, Target[]>()
  const byPath = new Map<string, Target[]>()
  // Annotations first: they are precise, inferred targets are a fallback.
  const sorted = [...all].sort((a, b) => (ORDER[a.source] ?? 1) - (ORDER[b.source] ?? 1))
  for (const t of sorted) {
    byEl.set(t.el, [...(byEl.get(t.el) ?? []), t])
    const k = `${refKey(t.ref)}|${t.path}`
    byPath.set(k, [...(byPath.get(k) ?? []), t])
  }
  return {
    all: sorted,
    at: (el) => byEl.get(el) ?? [],
    find: (key, path, kinds) =>
      (byPath.get(`${key}|${path}`) ?? []).find(
        (t) => t.el.isConnected && (!kinds || kinds.includes(t.kind)),
      ),
  }
}

const WATCHED = [ATTR.ref, ATTR.field, ATTR.row, ATTR.list, 'alt']

export function useTargets(locator: Locator, root: () => ParentNode | null): TargetIndex {
  const [index, setIndex] = useState<TargetIndex>(() => buildIndex([]))
  useEffect(() => {
    const r = root()
    if (!r) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const scan = () => {
      timer = undefined
      setIndex(buildIndex(locator.scan(r)))
    }
    scan()
    const ours = (n: Node | null) =>
      !!(n && (n instanceof Element ? n : n.parentElement)?.closest(`[${UI}]`))
    const observer = new MutationObserver((records) => {
      if (records.every((m) => ours(m.target))) return
      if (!timer) timer = setTimeout(scan, 120)
    })
    observer.observe(r as Node, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: WATCHED,
    })
    return () => {
      observer.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [locator, root])
  return index
}
