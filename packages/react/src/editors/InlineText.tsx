'use client';

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
import React, { useLayoutEffect, useRef } from 'react';
import type { FieldEditorProps } from '../context.tsx';
import { copyTypography, HIDDEN, placeCaret, placeOver, useEachFrame } from '../dom.ts';

export function InlineText({ field, path, value, element, commit, preview, close, ghost, live, point }: FieldEditorProps) {
  const multiline = field.type === 'textarea';
  const ref = useRef<HTMLDivElement>(null);
  const initial = useRef(value == null ? '' : String(value));
  const done = useRef(false);

  useLayoutEffect(() => {
    const el = element();
    const twin = ref.current;
    if (!twin) return;
    if (el) {
      copyTypography(el, twin);
      placeOver(twin, el, { minWidth: 40, minHeight: true });
      el.setAttribute(HIDDEN, 'true');
    }
    twin.textContent = initial.current;
    twin.focus({ preventScroll: true });
    placeCaret(twin, point);
    return () => element()?.removeAttribute(HIDDEN);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow the element as the page reflows (client mode re-renders it live).
  useEachFrame(() => {
    const el = element();
    const twin = ref.current;
    if (!el || !twin) return;
    if (!el.hasAttribute(HIDDEN)) el.setAttribute(HIDDEN, 'true');
    placeOver(twin, el, { minWidth: 40, minHeight: true });
  });

  const read = () => {
    // textContent, not innerText: innerText applies CSS (text-transform:
    // uppercase on an eyebrow would save "SANDBOX" for "Sandbox").
    const text = (ref.current?.textContent ?? '').replace(/ /g, ' ').replace(/\n$/, '');
    return multiline ? text : text.replace(/\s*\n\s*/g, ' ');
  };

  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    const text = read();
    if (save && text !== initial.current) {
      commit(text === '' && !field.required ? null : text);
      if (!live && ref.current) ghost({ html: escapeHtml(text), style: twinStyle(ref.current) });
    }
    close();
  };

  return (
    <div
      ref={ref}
      className="po-inline"
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      aria-multiline={multiline}
      aria-label={`Edit ${field.label}`}
      data-testid="onpage-inline-text"
      spellCheck
      onInput={() => live && preview(read())}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          finish(false);
        } else if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          finish(true);
        }
      }}
    />
  );
}

export const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function twinStyle(el: HTMLElement): Partial<CSSStyleDeclaration> {
  const out: Record<string, string> = {};
  for (const k of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'wordSpacing', 'textTransform', 'textAlign', 'textIndent', 'color', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']) {
    out[k] = (el.style as unknown as Record<string, string>)[k];
  }
  return out as Partial<CSSStyleDeclaration>;
}
