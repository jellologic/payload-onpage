'use client'

/**
 * Drag a row to another place in its list. Pointer only: keyboard users move
 * rows with the toolbar's buttons and ⌥↑/⌥↓, so the handle isn't a tab stop.
 */
import type { RefKey, RowInfo } from '@payload-onpage/core'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useOnPage } from '../context.tsx'
import { GripIcon } from '../icons.tsx'
import { rowOps } from '../rowOps.ts'

interface Slot {
  /** Where the row would go: an index in the list after removing it. */
  to: number
  /** The drop line, in viewport coordinates. */
  line: { top: number; left: number; width: number; height: number }
}

/** Rows side by side (a grid of cards) are ordered by x; stacked rows by y. */
const isRow = (rects: DOMRect[]) =>
  rects.length > 1 && rects.every((r) => Math.abs(r.top - rects[0]!.top) < r.height / 2)

/** The slot nearest the pointer: before the first row whose middle lies past it. */
export function slotAt(rects: DOMRect[], from: number, x: number, y: number): Slot | null {
  if (!rects.length) return null
  const horizontal = isRow(rects)
  let before = rects.findIndex((r) =>
    horizontal ? x < r.left + r.width / 2 : y < r.top + r.height / 2,
  )
  if (before === -1) before = rects.length
  const to = before > from ? before - 1 : before
  const ref = rects[Math.min(before, rects.length - 1)]!
  const edge = before === rects.length
  const line = horizontal
    ? { top: ref.top, left: edge ? ref.right : ref.left, width: 3, height: ref.height }
    : { top: edge ? ref.bottom : ref.top, left: ref.left, width: ref.width, height: 3 }
  return { to, line }
}

export function DragHandle({
  rowKey,
  info,
  testId,
}: {
  rowKey: RefKey
  info: RowInfo
  testId: string
}) {
  const { session, targets, setSelected, t } = useOnPage()
  const [slot, setSlot] = useState<Slot | null>(null)
  const rects = useRef<DOMRect[]>([])
  const dragging = useRef(false)

  const start = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || info.length < 2) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    rects.current = Array.from({ length: info.length }, (_, i) =>
      targets.find(rowKey, `${info.listPath}.${i}`, ['item'])?.el.getBoundingClientRect(),
    ).filter((r): r is DOMRect => !!r)
    if (rects.current.length !== info.length) return // some rows aren't on the page
    dragging.current = true
    setSelected({ key: rowKey, path: info.path }) // keep this toolbar while hovering other rows
  }
  const move = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragging.current) setSlot(slotAt(rects.current, info.index, e.clientX, e.clientY))
  }
  const stop = (drop: boolean) => {
    if (!dragging.current) return
    dragging.current = false
    const to = slot?.to
    setSlot(null)
    if (!drop || to === undefined) return
    const next = rowOps(session, rowKey, info).moveTo(to)
    if (next) setSelected(next)
  }
  useEffect(() => {
    if (!slot) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      dragging.current = false
      setSlot(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [slot])

  return (
    <>
      <button
        type="button"
        className="po-btn po-drag"
        tabIndex={-1}
        title={t('row.drag')}
        aria-label={t('row.drag')}
        disabled={info.length < 2}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={() => stop(true)}
        onPointerCancel={() => stop(false)}
        data-testid={testId}
      >
        <GripIcon />
      </button>
      {slot && slot.to !== info.index && (
        <div className="po-drop" style={slot.line} data-testid="onpage-drop-line" />
      )}
    </>
  )
}
