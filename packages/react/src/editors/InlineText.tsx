'use client'

/**
 * In-place editing for text, textarea and email fields.
 *
 * The site's element is never made editable (React owns its DOM). An editable
 * twin with the same computed typography is laid over it and the original is
 * hidden. In client mode each keystroke re-renders the page live underneath;
 * in refresh mode the twin shows the text and, after commit, stays as a ghost
 * until the server render arrives. Blur/Enter commits (one undo step), Escape
 * cancels.
 */
import { useLayoutEffect, useRef } from 'react'
import { toText } from '@payload-onpage/core'
import { copyTypography, HIDDEN, placeCaret, placeOver, typographyOf } from '../dom.ts'
import { useTrackElement } from '../layout.ts'
import type { FieldEditorProps } from '../types.ts'

export const escapeHtml = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

export function InlineText({
  field,
  value,
  element,
  commit,
  preview,
  close,
  ghost,
  live,
  point,
  t,
}: FieldEditorProps) {
  const multiline = field.type === 'textarea'
  const ref = useRef<HTMLDivElement>(null)
  const initial = useRef(toText(value))
  const done = useRef(false)

  useLayoutEffect(() => {
    const el = element()
    const twin = ref.current
    if (!twin) return
    if (el) {
      copyTypography(el, twin)
      placeOver(twin, el, { minWidth: 40, minHeight: true })
      el.setAttribute(HIDDEN, 'true')
    }
    twin.textContent = initial.current
    twin.focus({ preventScroll: true })
    placeCaret(twin, point)
    return () => element()?.removeAttribute(HIDDEN)
    // Runs once: the twin takes over the element for its lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Follow the element as the page reflows (client mode re-renders it live).
  useTrackElement(element, (el) => {
    if (!ref.current) return
    if (!el.hasAttribute(HIDDEN)) el.setAttribute(HIDDEN, 'true')
    placeOver(ref.current, el, { minWidth: 40, minHeight: true })
  })

  const read = () => {
    // textContent, not innerText: innerText applies CSS (text-transform:
    // uppercase on an eyebrow would save "SANDBOX" for "Sandbox").
    const text = (ref.current?.textContent ?? '').replace(/\u00a0/g, ' ').replace(/\n$/, '')
    return multiline ? text : text.replace(/\s*\n\s*/g, ' ')
  }

  const finish = (save: boolean) => {
    if (done.current) return
    done.current = true
    const text = read()
    if (save && text !== initial.current) {
      commit(text === '' && !field.required ? null : text)
      if (!live && ref.current) ghost({ html: escapeHtml(text), style: typographyOf(ref.current) })
    }
    close()
  }

  return (
    <div
      ref={ref}
      className="po-inline"
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      tabIndex={0}
      aria-multiline={multiline}
      aria-label={t('inline.label', { field: field.label })}
      data-testid="onpage-inline-text"
      spellCheck
      onInput={() => live && preview(read())}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          finish(false)
        } else if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          finish(true)
        }
      }}
    />
  )
}
