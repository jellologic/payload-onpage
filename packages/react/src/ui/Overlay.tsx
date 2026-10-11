'use client'

/**
 * Everything drawn over the page: hover outlines, the section and item
 * toolbars, "+" insert points and "+ Add" for lists. Positions are measured
 * from the target elements whenever the layout changes.
 */
import {
  cloneRow,
  fieldAtPath,
  getAt,
  insertItem,
  isEditablePath,
  moveItem,
  newArrayRow,
  refKey,
  removeItem,
  resolveRow,
  updateArray,
  type Doc,
  type RowInfo,
  type Target,
} from '@payload-onpage/core'
import { useEffect, useState } from 'react'
import { useOnPage } from '../context.tsx'
import { isOurs } from '../dom.ts'
import { useLayoutTick } from '../layout.ts'
import { targetsAt } from '../targets.ts'
import { hasSettings } from '../settings.ts'

interface Hover {
  field?: Target
  rows: Target[] // innermost first
}

const VIEW_PAD = 8

function useHover(): Hover {
  const { targets } = useOnPage()
  const [hover, setHover] = useState<Hover>({ rows: [] })
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const t = e.target
      if (!(t instanceof Element) || isOurs(t)) return // over our UI: keep the current hover
      const next = targetsAt(targets, t)
      setHover((h) =>
        h.field === next.field &&
        h.rows.length === next.rows.length &&
        h.rows.every((r, i) => r === next.rows[i])
          ? h
          : next,
      )
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [targets])
  return hover
}

function Outline({
  el,
  variant,
  label,
}: {
  el: Element
  variant?: 'block' | 'item'
  label?: string | undefined
}) {
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return (
    <>
      <div
        className={`po-outline${variant ? ` is-${variant}` : ''}`}
        style={{ top: r.top - 2, left: r.left - 2, width: r.width + 4, height: r.height + 4 }}
      />
      {label && (
        <div
          className={`po-chip${variant === 'item' ? ' is-item' : ''}`}
          style={{ top: Math.max(r.top - 2, 22), left: r.left - 2 }}
        >
          {label}
        </div>
      )}
    </>
  )
}

interface ActiveRow {
  key: string
  info: RowInfo
  el: Element
}

function RowToolbar({ row, variant }: { row: ActiveRow; variant: 'block' | 'item' }) {
  const { session, setSelected, setPanel, selected, targets, t } = useOnPage()
  const { key, info, el } = row
  const r = el.getBoundingClientRect()
  if (r.bottom < 40 || r.top > window.innerHeight - 40) return null
  const top = Math.min(Math.max(r.top + VIEW_PAD, 60), r.bottom - 40)
  const right = Math.max(window.innerWidth - r.right + VIEW_PAD, VIEW_PAD)
  const { listPath, index, length, rowFields, path } = info
  const label = targets.find(key, path, ['item'])?.label || info.label
  const apply = (fn: (d: Doc) => Doc) => session.apply(key, fn)
  const max = info.listField.maxRows
  const min = info.listField.minRows ?? 0

  const move = (dir: -1 | 1) => {
    apply((d) => updateArray(d, listPath, (a) => moveItem(a, index, index + dir)))
    setSelected({ key, path: `${listPath}.${index + dir}` })
  }
  const duplicate = () => {
    apply((d) =>
      updateArray(d, listPath, (a) => insertItem(a, index + 1, cloneRow(a[index], rowFields))),
    )
    setSelected({ key, path: `${listPath}.${index + 1}` })
  }
  const remove = () => {
    apply((d) => updateArray(d, listPath, (a) => removeItem(a, index)))
    if (selected?.key === key && selected.path.startsWith(path)) setSelected(null)
  }
  return (
    <div
      className={`po-bar${variant === 'item' ? ' is-item' : ''}`}
      style={{ top, right }}
      role="toolbar"
      aria-label={t('row.toolbar', { label })}
      data-testid={`onpage-${variant}-toolbar`}
    >
      <span className="po-btn po-bar-label">{label}</span>
      <button
        type="button"
        className="po-btn"
        disabled={index === 0}
        onClick={() => move(-1)}
        aria-label={t('row.moveUp')}
        title={t('row.moveUp')}
        data-testid={`onpage-${variant}-up`}
      >
        ↑
      </button>
      <button
        type="button"
        className="po-btn"
        disabled={index >= length - 1}
        onClick={() => move(1)}
        aria-label={t('row.moveDown')}
        title={t('row.moveDown')}
        data-testid={`onpage-${variant}-down`}
      >
        ↓
      </button>
      <button
        type="button"
        className="po-btn"
        disabled={max !== undefined && length >= max}
        onClick={duplicate}
        aria-label={t('row.duplicate')}
        title={t('row.duplicate')}
        data-testid={`onpage-${variant}-duplicate`}
      >
        ⧉
      </button>
      {hasSettings(rowFields, path, key, targets) && (
        <button
          type="button"
          className="po-btn"
          onClick={() => setPanel({ kind: 'settings', key, path, title: label })}
          aria-label={t('row.settings')}
          title={t('row.settings')}
          data-testid={`onpage-${variant}-settings`}
        >
          ⚙
        </button>
      )}
      <button
        type="button"
        className="po-btn is-danger"
        disabled={length <= min}
        onClick={remove}
        aria-label={t('row.delete')}
        title={t('row.delete')}
        data-testid={`onpage-${variant}-delete`}
      >
        ✕
      </button>
    </div>
  )
}

function InsertPoints({ row }: { row: ActiveRow }) {
  const { setPanel, t } = useOnPage()
  const r = row.el.getBoundingClientRect()
  const x = r.left + r.width / 2
  const at = (index: number, y: number, edge: 'above' | 'below') =>
    y > 0 && y < window.innerHeight ? (
      <div className="po-add" style={{ top: y, left: x }} key={edge}>
        <button
          type="button"
          className="po-btn"
          onClick={() =>
            setPanel({ kind: 'blocks', key: row.key, listPath: row.info.listPath, index })
          }
          aria-label={`${t('row.addSection')} (${edge})`}
          data-testid={`onpage-insert-${edge}`}
        >
          + {t('row.addSection')}
        </button>
      </div>
    ) : null
  return (
    <>
      {at(row.info.index, r.top, 'above')}
      {at(row.info.index + 1, r.bottom, 'below')}
    </>
  )
}

function AddItem({ list }: { list: Target }) {
  const { snap, session, setPanel, setSelected, t } = useOnPage()
  const key = refKey(list.ref)
  const state = snap.docs[key]
  if (!state?.schema || !state.doc || !isEditablePath(state.schema, list.path)) return null
  const field = fieldAtPath(state.schema.fields, state.doc, list.path)?.field
  if (!field || (field.type !== 'array' && field.type !== 'blocks')) return null
  const length = (getAt<unknown[]>(state.doc, list.path) ?? []).length
  const r = list.el.getBoundingClientRect()
  if (field.type === 'blocks') {
    // Sections get "+ Add section" above/below each one; this covers an empty list.
    if (length) return null
    return (
      <div
        className="po-add"
        style={{ top: r.top + Math.min(r.height / 2, 160), left: r.left + r.width / 2 }}
      >
        <button
          type="button"
          className="po-btn"
          onClick={() => setPanel({ kind: 'blocks', key, listPath: list.path, index: 0 })}
          data-testid="onpage-add-first-section"
        >
          + {t('row.addFirstSection')}
        </button>
      </div>
    )
  }
  if (field.maxRows !== undefined && length >= field.maxRows) return null
  // Below the list, or pinned to the bottom of the viewport while the list runs past it.
  if (r.bottom < 0 || r.top > window.innerHeight - 40) return null
  const y = Math.min(r.bottom + 14, window.innerHeight - 84)
  const item = list.label || field.labels?.singular || field.label
  const add = () => {
    session.apply(key, (d) => updateArray(d, list.path, (a) => [...a, newArrayRow(field)]))
    setSelected({ key, path: `${list.path}.${length}` })
  }
  return (
    <div className="po-add is-item" style={{ top: y, left: r.left + r.width / 2 }}>
      <button type="button" className="po-btn" onClick={add} data-testid="onpage-add-item">
        + {t('row.addItem', { item })}
      </button>
    </div>
  )
}

export function Overlay() {
  const { selected, editing, targets, snap } = useOnPage()
  useLayoutTick()
  const hover = useHover()

  const rowFor = (target: Target | undefined): ActiveRow | null => {
    if (!target) return null
    const key = refKey(target.ref)
    const state = snap.docs[key]
    const info =
      state?.schema && state.doc ? resolveRow(state.schema, state.doc, target.path) : null
    return info ? { key, info, el: target.el } : null
  }

  // The active row: the selected one, else the innermost hovered row.
  const active = rowFor(
    selected ? targets.find(selected.key, selected.path, ['item']) : hover.rows[0],
  )

  // Its section: the outermost enclosing row of a blocks field (may be itself).
  let section: ActiveRow | null = null
  if (active) {
    const segs = active.info.path.split('.')
    for (let i = 1; i < segs.length && !section; i++) {
      if (!/^\d+$/.test(segs[i])) continue
      const path = segs.slice(0, i + 1).join('.')
      const candidate =
        path === active.info.path ? active : rowFor(targets.find(active.key, path, ['item']))
      if (candidate?.info.isBlock) section = candidate
    }
  }
  const item = active && section?.info.path !== active.info.path ? active : null

  // "+ Add" for the active item's list, and for empty annotated lists.
  const lists = targets.all.filter((t) => t.kind === 'list')
  const itemList = item
    ? lists.find((l) => refKey(l.ref) === item.key && l.path === item.info.listPath)
    : undefined
  const emptyLists = lists.filter((l) => {
    const doc = snap.docs[refKey(l.ref)]?.doc
    return doc && !(getAt<unknown[]>(doc, l.path) ?? []).length
  })
  const hoverField = !editing ? hover.field : undefined

  return (
    <>
      {section && <Outline el={section.el} variant="block" />}
      {item && <Outline el={item.el} variant="item" />}
      {hoverField && <Outline el={hoverField.el} label={hoverField.label} />}
      {!editing && section && <InsertPoints row={section} />}
      {!editing && section && <RowToolbar row={section} variant="block" />}
      {!editing && item && <RowToolbar row={item} variant="item" />}
      {!editing && itemList && <AddItem list={itemList} />}
      {!editing &&
        emptyLists
          .filter((l) => l !== itemList)
          .map((l) => <AddItem key={`${refKey(l.ref)}|${l.path}`} list={l} />)}
    </>
  )
}
