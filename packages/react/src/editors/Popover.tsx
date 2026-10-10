'use client';

/** The shell every popover editor renders in: anchored to the element, closes on outside click or Escape. */
import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { popoverPosition, useFrame } from '../dom.ts';

export function Popover({ anchor, title, onClose, children, width = 300, testId }: { anchor: () => Element | null; title: string; onClose: () => void; children: ReactNode; width?: number; testId?: string }) {
  useFrame();
  const box = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(240);
  useEffect(() => {
    if (box.current) setHeight(box.current.offsetHeight);
  });
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    // Defer so the click that opened the popover doesn't close it.
    const t = setTimeout(() => {
      document.addEventListener('pointerdown', onDown, true);
      document.addEventListener('keydown', onKey, true);
    });
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);
  const pos = popoverPosition(anchor(), { width, height });
  return (
    <div ref={box} className="po-pop" style={{ ...pos, width }} role="dialog" aria-label={title} data-testid={testId ?? 'onpage-popover'}>
      <div className="po-row" style={{ flexDirection: 'row', alignItems: 'center' }}>
        <label style={{ flex: 1 }}>{title}</label>
        <button type="button" className="po-btn" style={{ color: '#0f172a', minWidth: 22, height: 22 }} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      {children}
    </div>
  );
}
