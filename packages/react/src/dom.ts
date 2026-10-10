/** DOM helpers shared by the editor UI. Browser-only. */
import { useEffect, useState } from "react";

export const HIDDEN = "data-onpage-hidden";
export const UI = "data-onpage-ui";

/** Computed styles copied onto an inline editor so it looks like the element it replaces. */
export const TYPOGRAPHY = [
  "fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "letterSpacing", "wordSpacing",
  "textTransform", "textAlign", "textIndent", "color", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
] as const;

export function copyTypography(from: Element, to: HTMLElement) {
  const cs = getComputedStyle(from);
  for (const k of TYPOGRAPHY) (to.style as unknown as Record<string, string>)[k] = cs[k];
}

/** Place an absolutely positioned (document layer) box over `el`. */
export function placeOver(box: HTMLElement, el: Element, opts: { minWidth?: number; minHeight?: boolean } = {}) {
  const r = el.getBoundingClientRect();
  box.style.top = `${r.top + window.scrollY}px`;
  box.style.left = `${r.left + window.scrollX}px`;
  box.style.width = `${Math.max(r.width, opts.minWidth ?? 0)}px`;
  if (opts.minHeight) box.style.minHeight = `${r.height}px`;
}

export function isOurs(node: EventTarget | null): boolean {
  return node instanceof Element && !!node.closest(`[${UI}]`);
}

/** Place the caret at a viewport point inside `el`, else at the end. */
export function placeCaret(el: HTMLElement, point?: { x: number; y: number }) {
  const sel = window.getSelection();
  if (!sel) return;
  let range: Range | null = null;
  const hit = point ? caretAt(point, el) : null;
  if (hit) {
    range = document.createRange();
    range.setStart(hit.node, hit.offset);
  } else {
    range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
  }
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** The DOM caret position under a viewport point, if it falls inside `within`. */
export function caretAt(point: { x: number; y: number }, within: Element): { node: Node; offset: number } | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const pos = doc.caretPositionFromPoint?.(point.x, point.y);
  if (pos && within.contains(pos.offsetNode)) return { node: pos.offsetNode, offset: pos.offset };
  const r = doc.caretRangeFromPoint?.(point.x, point.y);
  if (r && within.contains(r.startContainer)) return { node: r.startContainer, offset: r.startOffset };
  return null;
}

/** Re-render whenever the page scrolls, resizes or reflows (checked once per frame). */
export function useFrame() {
  const [, setTick] = useState(0);
  useEffect(() => {
    let raf = 0;
    let last = "";
    const loop = () => {
      const sig = `${window.scrollX},${window.scrollY},${window.innerWidth},${window.innerHeight},${document.body.scrollHeight}`;
      if (sig !== last) {
        last = sig;
        setTick((t) => t + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}

/** Run `fn` every animation frame while mounted. */
export function useEachFrame(fn: () => void) {
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      fn();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });
}

/** Position a fixed popover below (or above) an element, kept inside the viewport. */
export function popoverPosition(el: Element | null, size = { width: 300, height: 320 }): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!el) return { top: 80, left: Math.max(8, vw / 2 - size.width / 2) };
  const r = el.getBoundingClientRect();
  const below = r.bottom + 8;
  const top = below + size.height < vh ? below : Math.max(8, r.top - 8 - size.height);
  const left = Math.min(Math.max(8, r.left), vw - size.width - 8);
  return { top, left };
}
