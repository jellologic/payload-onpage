'use client'

import { useEffect, useState } from 'react'

/**
 * Run `search(query, page)` 250ms after the inputs settle; results accumulate
 * across pages and reset when the query changes. Stale responses are ignored.
 */
export function useDebouncedSearch<T>(
  search: ((query: string, page: number) => Promise<{ items: T[]; hasMore: boolean }>) | null,
  deps: unknown[],
) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<T[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!search) return
    let live = true
    const timer = setTimeout(() => {
      setBusy(true)
      search(query, page)
        .then((res) => {
          if (!live) return
          setItems((prev) => (page === 1 ? res.items : [...prev, ...res.items]))
          setHasMore(res.hasMore)
          setError(null)
        })
        .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)))
        .finally(() => live && setBusy(false))
    }, 250)
    return () => {
      live = false
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, query, page, ...deps])

  return {
    query,
    setQuery: (q: string) => {
      setQuery(q)
      setPage(1)
    },
    items,
    hasMore,
    more: () => setPage((p) => p + 1),
    busy,
    error,
  }
}
