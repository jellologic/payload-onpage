'use client';

import React from 'react';
import { fieldAtPath, insertItem, newBlockRow, updateArray } from '@payload-onpage/core';
import { useOnPage } from './context.tsx';

/** Choose a block type to insert at a position in a blocks field. */
export function BlockPicker() {
  const { panel, setPanel, snap, session, setSelected } = useOnPage();
  if (panel?.kind !== 'blocks') return null;
  const state = snap.docs[panel.key];
  if (!state?.schema || !state.doc) return null;
  const { key, listPath, index } = panel;
  const field = fieldAtPath(state.schema.fields, state.doc, listPath)?.field;
  const blocks = field?.type === 'blocks' ? field.blocks ?? [] : [];

  const choose = (slug: string) => {
    const block = blocks.find((b) => b.slug === slug);
    if (!block) return;
    session.apply(key, (d) => updateArray(d, listPath, (a) => insertItem(a, index, newBlockRow(block))));
    setPanel(null);
    setSelected({ key, path: `${listPath}.${index}` });
  };

  return (
    <div className="po-modal-bg" onClick={() => setPanel(null)} data-testid="onpage-block-picker">
      <div className="po-modal" role="dialog" aria-label="Add section" onClick={(e) => e.stopPropagation()} style={{ width: 'min(640px,100%)' }}>
        <header>
          <div className="po-h3">Add section</div>
          <button className="po-btn" onClick={() => setPanel(null)} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="po-body">
          <div className="po-blocks">
            {blocks.map((b) => (
              <button key={b.slug} onClick={() => choose(b.slug)} data-testid={`onpage-block-${b.slug}`}>
                {b.labels.singular}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
