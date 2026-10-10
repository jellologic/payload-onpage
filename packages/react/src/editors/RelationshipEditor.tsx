'use client'

/**
 * Relationship editor: search the related collection(s) by their title field
 * (Payload REST, so access control applies) and pick one, or several for
 * hasMany. Polymorphic fields get a collection switch and store `{ relationTo, value }`.
 */
import { relationId, relationTitle, type SearchHit } from '@payload-onpage/core'
import { useCallback, useState } from 'react'
import { useOnPage } from '../context.tsx'
import type { FieldEditorProps } from '../types.ts'
import { Dialog } from '../ui/Dialog.tsx'
import { useDebouncedSearch } from './useDebouncedSearch.ts'

export function RelationshipEditor({
  docKey,
  field,
  value,
  element,
  commit,
  close,
  t,
}: FieldEditorProps) {
  const { session, snap } = useOnPage()
  const targets = Array.isArray(field.relationTo)
    ? field.relationTo
    : field.relationTo
      ? [field.relationTo]
      : []
  const poly = Array.isArray(field.relationTo)
  const [collection, setCollection] = useState(targets[0] ?? '')
  const relations = snap.docs[docKey]?.schema?.relations ?? {}
  const titleField = relations[collection]?.titleField
  const many = !!field.hasMany
  const current: unknown[] = many
    ? Array.isArray(value)
      ? value
      : []
    : value == null
      ? []
      : [value]
  const ds = session.dataSource
  const search = useCallback(
    async (query: string) =>
      ds.search
        ? {
            items: await ds.search(collection, {
              query,
              titleField,
              locale: session.locale,
              limit: 12,
            }),
            hasMore: false,
          }
        : { items: [] as SearchHit[], hasMore: false },
    [ds, collection, titleField, session.locale],
  )
  const results = useDebouncedSearch<SearchHit>(ds.search ? search : null, [])

  const wrap = (hit: SearchHit): unknown =>
    poly ? { relationTo: collection, value: hit.doc } : hit.doc
  const same = (v: unknown, id: string | number) => String(relationId(v)) === String(id)
  const pick = (hit: SearchHit) => {
    if (!many) {
      commit(wrap(hit))
      close()
      return
    }
    commit(
      current.some((v) => same(v, hit.id))
        ? current.filter((v) => !same(v, hit.id))
        : [...current, wrap(hit)],
    )
  }
  const remove = (i: number) => commit(many ? current.filter((_, j) => j !== i) : null)

  return (
    <Dialog
      variant="popover"
      anchor={element}
      title={field.label}
      onClose={close}
      t={t}
      width={320}
      testId="onpage-relationship"
    >
      {current.map((v, i) => (
        <div className="po-rel-item" key={`${String(relationId(v))}-${i}`}>
          {relationTitle(v, titleField)}
          {(!field.required || many) && (
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={`${t('common.remove')} ${relationTitle(v, titleField)}`}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {poly && (
        <div className="po-seg" role="radiogroup" aria-label={field.label}>
          {targets.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={c === collection}
              onClick={() => setCollection(c)}
            >
              {relations[c]?.label ?? c}
            </button>
          ))}
        </div>
      )}
      {!ds.search ? (
        <p className="po-muted">{t('search.unsupported')}</p>
      ) : (
        <>
          <input
            className="po-input"
            aria-label={t('search.placeholder')}
            placeholder={t('search.placeholder')}
            value={results.query}
            data-autofocus
            onChange={(e) => results.setQuery(e.target.value)}
            data-testid="onpage-relationship-search"
          />
          {results.error && <p className="po-error">{results.error}</p>}
          <div
            className="po-pop-list"
            role="listbox"
            aria-multiselectable={many}
            aria-label={field.label}
          >
            {results.items.map((h) => (
              <button
                key={String(h.id)}
                type="button"
                role="option"
                aria-selected={current.some((v) => same(v, h.id))}
                onClick={() => pick(h)}
                data-testid={`onpage-relationship-${h.id}`}
              >
                {h.title}
              </button>
            ))}
          </div>
        </>
      )}
    </Dialog>
  )
}
