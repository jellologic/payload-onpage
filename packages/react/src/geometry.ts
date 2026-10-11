/**
 * Where the editor's floating UI goes: named distances (px) and the positioning
 * rules shared by the overlay, toolbars and popovers.
 */
type Rect = Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right' | 'width' | 'height'>

export const GEOMETRY = {
  /** Gap kept between floating UI and the viewport edge or its element. */
  margin: 8,
  /** How far an outline sits outside its element. */
  outline: 2,
  /** Height of a row toolbar. */
  toolbar: 40,
  /** Toolbars never ride higher than this (the site header usually lives there). */
  toolbarMinTop: 60,
  /** Field label chips never go above this. */
  chipMinTop: 22,
  /** Gap between a list and its "+ Add" button. */
  addGap: 14,
  /** Room left at the bottom for the dock. */
  dock: 84,
  /** "+ Add first section" sits at most this far down an empty list. */
  emptyListOffset: 160,
} as const

const { margin, outline, toolbar, toolbarMinTop, addGap, dock } = GEOMETRY

/** Is any of the element on screen, `inset` px inside the top and bottom? */
export const inViewport = (r: Rect, inset = 0): boolean =>
  r.bottom >= inset && r.top <= window.innerHeight - inset

/** An outline box around an element. */
export const outlineBox = (r: Rect) => ({
  top: r.top - outline,
  left: r.left - outline,
  width: r.width + 2 * outline,
  height: r.height + 2 * outline,
})

/** A row toolbar: top-right inside the row, kept below the header and above the row's end. */
export const toolbarPosition = (r: Rect) => ({
  top: Math.min(Math.max(r.top + margin, toolbarMinTop), r.bottom - toolbar),
  right: Math.max(window.innerWidth - r.right + margin, margin),
})

/** "+ Add" below a list, or pinned above the dock while the list runs past the viewport. */
export const belowList = (r: Rect): number => Math.min(r.bottom + addGap, window.innerHeight - dock)

/** A fixed popover below (or, without room, above) an element, kept inside the viewport. */
export function popoverPosition(
  el: Element | null,
  size = { width: 300, height: 320 },
): { top: number; left: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (!el) return { top: 80, left: Math.max(margin, vw / 2 - size.width / 2) }
  const r = el.getBoundingClientRect()
  const below = r.bottom + margin
  const top = below + size.height < vh ? below : Math.max(margin, r.top - margin - size.height)
  const left = Math.min(Math.max(margin, r.left), vw - size.width - margin)
  return { top, left }
}
