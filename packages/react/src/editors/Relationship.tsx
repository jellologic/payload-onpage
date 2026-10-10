'use client'

/**
 * Relationship editor: search the related collection(s) by title and pick one
 * (or several, for hasMany). Polymorphic fields get a collection switch and
 * store `{ relationTo, value }`. Needs the DataSource's optional `search`.
 */
import React, { useEffect, useState } from 'react'
import type { SearchHit } from '@payload-onpage/core'
import { useOnPage, type FieldEditorProps } from '../context.tsx'
import { Popover } from './Popover.tsx'

type Rel = unknown

const idOf = (v: Rel): string | number | undefined => {
  if (v == null) return undefined
  if (typeof v === 'string' || typeof v === 'number') return v
  const o = v as Record<string, unknown>
  if ('relationTo' in o) return idOf(o.value)
  return o.id as string | number | undefined
}
const titleOf = (v: Rel): string => {
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    if ('relationTo' in o) return titleOf(o.value)
    for (const k of ['title', 'name', 'label', 'slug', 'filename'])
      if (typeof o[k] === 'string' && o[k]) return o[k] as string
  }
  return String(idOf(v) ?? '')
}

export function RelationshipEditor({ field, value, element, commit, close }: FieldEditorProps) {
  const { session } = useOnPage()
  const targets = Array.isArray(field.relationTo)
    ? field.relationTo
    : field.relationTo
      ? [field.relationTo]
      : []
  const poly = Array.isArray(field.relationTo)
  const [collection, setCollection] = useState(targets[0] ?? '')
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [error, setError] = useState<string | null>(null)
  const many = !!field.hasMany
  const current: Rel[] = many ? (Array.isArray(value) ? value : []) : value == null ? [] : [value]
  const search = session.dataSource.search?.bind(session.dataSource)

  useEffect(() => {
    if (!search || !collection) return
    let live = true
    const t = setTimeout(() => {
      search(collection, { query, locale: session.locale, limit: 12 })
        .then((docs) => live && (setHits(docs), setError(null)))
        .catch((e: Error) => live && setError(e.message))
    }, 200)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [search, collection, query, session.locale])

  const wrap = (hit: SearchHit): Rel =>
    poly ? { relationTo: collection, value: hit.doc } : hit.doc
  const pick = (hit: SearchHit) => {
    if (!many) {
      commit(wrap(hit))
      close()
      return
    }
    const exists = current.some((v) => String(idOf(v)) === String(hit.id))
    commit(
      exists ? current.filter((v) => String(idOf(v)) !== String(hit.id)) : [...current, wrap(hit)],
    )
  }
  const remove = (i: number) => commit(many ? current.filter((_, j) => j !== i) : null)

  return (
    <Popover
      anchor={element}
      title={field.label}
      onClose={close}
      width={320}
      testId="onpage-relationship"
    >
      {current.map((v, i) => (
        <div className="po-rel-item" key={`${idOf(v)}-${i}`}>
          {titleOf(v)}
          {(!field.required || many) && (
            <button type="button" onClick={() => remove(i)} aria-label={`Remove ${titleOf(v)}`}>
              ✕
            </button>
          )}
        </div>
      ))}
      {poly && (
        <div className="po-seg" style={{ margin: '6px 0' }}>
          {targets.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={t === collection}
              onClick={() => setCollection(t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      {!search ? (
        <p style={{ color: '#64748b', margin: 0 }}>This data source can&apos;t search documents.</p>
      ) : (
        <>
          <input
            className="po-input"
            placeholder="Search…"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
            data-testid="onpage-relationship-search"
          />
          {error && <p style={{ color: '#b91c1c', margin: '6px 0 0' }}>{error}</p>}
          <div className="po-pop-list" role="listbox" style={{ marginTop: 6 }}>
            {hits.map((h) => (
              <button
                key={String(h.id)}
                type="button"
                role="option"
                aria-selected={current.some((v) => String(idOf(v)) === String(h.id))}
                onClick={() => pick(h)}
                data-testid={`onpage-relationship-${h.id}`}
              >
                {h.title}
              </button>
            ))}
          </div>
        </>
      )}
    </Popover>
  )
}
