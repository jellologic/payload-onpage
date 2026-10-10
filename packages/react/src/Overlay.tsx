'use client';

/**
 * Everything drawn over the page: hover outlines, the section and item
 * toolbars, "+" insert points and "+ Add" for lists. Positions are read from
 * the target elements each frame, so they follow scrolling, reflow and
 * re-renders (client or server).
 */
import React, { useEffect, useState } from 'react';
import { cloneRow, fieldAtPath, refKey, getAt, insertItem, moveItem, newArrayRow, removeItem, splitItemPath, updateArray, type Doc, type DocumentSchema, type SchemaField, type Target } from '@payload-onpage/core';
import { useOnPage, type OnPageContextValue } from './context.tsx';
import { isOurs, useFrame } from './dom.ts';
import { hasSettings } from './SettingsPanel.tsx';

const FIELD_KINDS = new Set(['text', 'textarea', 'richtext', 'media', 'field']);

interface Hover {
  field?: Target;
  rows: Target[]; // innermost first
}

function useHover(): Hover {
  const { targets } = useOnPage();
  const [hover, setHover] = useState<Hover>({ rows: [] });
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Element) || isOurs(t)) return; // over our UI: keep the current hover
      let field: Target | undefined;
      const rows: Target[] = [];
      for (let el: Element | null = t; el; el = el.parentElement) {
        for (const x of targets.at(el)) {
          if (!field && FIELD_KINDS.has(x.kind)) field = x;
          else if (x.kind === 'item' || x.kind === 'block') rows.push(x);
        }
      }
      setHover((h) => (h.field === field && h.rows.length === rows.length && h.rows.every((r, i) => r === rows[i]) ? h : { field, rows }));
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [targets]);
  return hover;
}

const VIEW_PAD = 8;

function Outline({ el, variant, label }: { el: Element; variant?: 'block' | 'item'; label?: string | null }) {
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return (
    <>
      <div className={`po-outline${variant ? ` is-${variant}` : ''}`} style={{ top: r.top - 2, left: r.left - 2, width: r.width + 4, height: r.height + 4 }} />
      {label && (
        <div className={`po-chip${variant === 'item' ? ' is-item' : ''}`} style={{ top: Math.max(r.top - 2, 22), left: r.left - 2 }}>
          {label}
        </div>
      )}
    </>
  );
}

export interface RowInfo {
  key: string;
  path: string;
  listPath: string;
  index: number;
  length: number;
  listField: SchemaField;
  rowFields: SchemaField[];
  label: string;
  isBlock: boolean;
  schema: DocumentSchema;
  doc: Doc;
}

export function rowInfo(ctx: OnPageContextValue, key: string, path: string): RowInfo | null {
  const state = ctx.snap.docs[key];
  const schema = state?.schema;
  const doc = state?.doc;
  if (!schema || !doc) return null;
  const split = splitItemPath(path);
  if (!split) return null;
  const [listPath, index] = split;
  if (!schema.editable.includes(listPath.split('.')[0])) return null;
  const listField = fieldAtPath(schema.fields, doc, listPath)?.field;
  if (!listField || (listField.type !== 'array' && listField.type !== 'blocks')) return null;
  const arr = getAt<unknown[]>(doc, listPath) ?? [];
  if (index >= arr.length) return null;
  const isBlock = listField.type === 'blocks';
  const blockType = isBlock ? getAt<string>(doc, `${path}.blockType`) : undefined;
  const block = isBlock ? listField.blocks?.find((b) => b.slug === blockType) : undefined;
  return {
    key,
    path,
    listPath,
    index,
    length: arr.length,
    listField,
    rowFields: isBlock ? block?.fields ?? [] : listField.fields ?? [],
    label: isBlock ? block?.labels.singular ?? 'Section' : listField.label.replace(/s$/, ''),
    isBlock,
    schema,
    doc,
  };
}

function RowToolbar({ info, el, variant }: { info: RowInfo; el: Element; variant: 'block' | 'item' }) {
  const { session, setSelected, setPanel, selected, targets } = useOnPage();
  const r = el.getBoundingClientRect();
  if (r.bottom < 40 || r.top > window.innerHeight - 40) return null;
  const top = Math.min(Math.max(r.top + VIEW_PAD, 60), r.bottom - 40);
  const right = Math.max(window.innerWidth - r.right + VIEW_PAD, VIEW_PAD);
  const { key, path, listPath, index, length, rowFields, isBlock } = info;
  const min = info.listField.minRows ?? 0;
  const label = targets.find(key, path, ['item', 'block'])?.label || info.label;
  const apply = (fn: (d: Doc) => Doc) => session.apply(key, fn);

  const move = (dir: -1 | 1) => {
    apply((d) => updateArray(d, listPath, (a) => moveItem(a, index, index + dir)));
    setSelected({ key, path: `${listPath}.${index + dir}` });
  };
  const duplicate = () => {
    apply((d) => updateArray(d, listPath, (a) => insertItem(a, index + 1, cloneRow(a[index], rowFields))));
    setSelected({ key, path: `${listPath}.${index + 1}` });
  };
  const remove = () => {
    apply((d) => updateArray(d, listPath, (a) => removeItem(a, index)));
    if (selected?.key === key && selected.path.startsWith(path)) setSelected(null);
  };
  const t = isBlock ? 'section' : 'item';
  return (
    <div className={`po-bar${variant === 'item' ? ' is-item' : ''}`} style={{ top, right }} data-testid={`onpage-${variant}-toolbar`}>
      <span className="po-btn" style={{ cursor: 'default', opacity: 0.8 }}>{label}</span>
      <button className="po-btn" disabled={index === 0} onClick={() => move(-1)} aria-label={`Move ${t} up`} title="Move up" data-testid={`onpage-${variant}-up`}>↑</button>
      <button className="po-btn" disabled={index >= length - 1} onClick={() => move(1)} aria-label={`Move ${t} down`} title="Move down" data-testid={`onpage-${variant}-down`}>↓</button>
      <button
        className="po-btn"
        disabled={info.listField.maxRows !== undefined && length >= info.listField.maxRows}
        onClick={duplicate}
        aria-label={`Duplicate ${t}`}
        title="Duplicate"
        data-testid={`onpage-${variant}-duplicate`}
      >
        ⧉
      </button>
      {hasSettings(info.rowFields, path, key, targets) && (
        <button className="po-btn" onClick={() => setPanel({ kind: 'settings', key, path, title: label })} aria-label={`${label} settings`} title="Settings" data-testid={`onpage-${variant}-settings`}>
          ⚙
        </button>
      )}
      <button className="po-btn is-danger" disabled={length <= min} onClick={remove} aria-label={`Delete ${t}`} title="Delete (undo with ⌘Z)" data-testid={`onpage-${variant}-delete`}>
        ✕
      </button>
    </div>
  );
}

function InsertPoints({ info, el }: { info: RowInfo; el: Element }) {
  const { setPanel } = useOnPage();
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const at = (index: number, y: number, edge: string) =>
    y > 0 && y < window.innerHeight ? (
      <div className="po-add" style={{ top: y, left: x }} key={edge}>
        <button className="po-btn" onClick={() => setPanel({ kind: 'blocks', key: info.key, listPath: info.listPath, index })} data-testid={`onpage-insert-${edge}`}>
          + Add section
        </button>
      </div>
    ) : null;
  return (
    <>
      {at(info.index, r.top, 'above')}
      {at(info.index + 1, r.bottom, 'below')}
    </>
  );
}

function AddItem({ list }: { list: Target }) {
  const ctx = useOnPage();
  const key = refKey(list.ref);
  const state = ctx.snap.docs[key];
  if (!state?.schema || !state.doc || !state.schema.editable.includes(list.path.split('.')[0])) return null;
  const field = fieldAtPath(state.schema.fields, state.doc, list.path)?.field;
  if (!field || (field.type !== 'array' && field.type !== 'blocks')) return null;
  const length = (getAt<unknown[]>(state.doc, list.path) ?? []).length;
  const r = list.el.getBoundingClientRect();
  if (field.type === 'blocks') {
    // Sections get "+ Add section" above/below each one; this covers an empty list.
    if (length) return null;
    return (
      <div className="po-add" style={{ top: r.top + Math.min(r.height / 2, 160), left: r.left + r.width / 2 }}>
        <button className="po-btn" onClick={() => ctx.setPanel({ kind: 'blocks', key, listPath: list.path, index: 0 })} data-testid="onpage-add-first-section">
          + Add a section
        </button>
      </div>
    );
  }
  if (field.maxRows !== undefined && length >= field.maxRows) return null;
  // Below the list, or pinned to the bottom of the viewport while the list runs past it.
  if (r.bottom < 0 || r.top > window.innerHeight - 40) return null;
  const y = Math.min(r.bottom + 14, window.innerHeight - 84);
  const label = list.label || field.label.replace(/s$/, '');
  const add = () => {
    ctx.session.apply(key, (d) => updateArray(d, list.path, (a) => [...a, newArrayRow(field)]));
    ctx.setSelected({ key, path: `${list.path}.${length}` });
  };
  return (
    <div className="po-add is-item" style={{ top: y, left: r.left + r.width / 2 }}>
      <button className="po-btn" onClick={add} data-testid="onpage-add-item">
        + Add {label.toLowerCase()}
      </button>
    </div>
  );
}

const keyOf = (t: Target) => refKey(t.ref);

export function Overlay() {
  const ctx = useOnPage();
  const { selected, editing, targets } = ctx;
  useFrame();
  const hover = useHover();

  // The active row: the selected one, else the innermost hovered row.
  const active = selected ? targets.find(selected.key, selected.path, ['item', 'block']) : hover.rows[0];
  const activeKey = active ? keyOf(active) : null;
  const activeInfo = active && activeKey ? rowInfo(ctx, activeKey, active.path) : null;

  // Its section: the outermost enclosing row of a blocks field (may be itself).
  let section: { info: RowInfo; el: Element } | null = null;
  if (activeInfo && activeKey) {
    const segs = activeInfo.path.split('.');
    for (let i = 1; i < segs.length && !section; i++) {
      if (!/^\d+$/.test(segs[i])) continue;
      const p = segs.slice(0, i + 1).join('.');
      const info = p === activeInfo.path ? activeInfo : rowInfo(ctx, activeKey, p);
      const el = p === activeInfo.path ? active!.el : targets.find(activeKey, p, ['item', 'block'])?.el;
      if (info?.isBlock && el) section = { info, el };
    }
  }
  const item = activeInfo && active && (!section || section.info.path !== activeInfo.path) ? { info: activeInfo, el: active.el } : null;

  // "+ Add" for the active item's list, and for empty annotated lists in view.
  const lists = targets.all.filter((t) => t.kind === 'list');
  const itemList = item ? lists.find((l) => keyOf(l) === item.info.key && l.path === item.info.listPath) : undefined;
  const emptyLists = lists.filter((l) => {
    const state = ctx.snap.docs[keyOf(l)];
    return state?.doc && !(getAt<unknown[]>(state.doc, l.path) ?? []).length;
  });
  const hoverField = !editing && hover.field && hover.field.kind !== 'item' ? hover.field : null;

  return (
    <>
      {section && <Outline el={section.el} variant="block" />}
      {item && <Outline el={item.el} variant="item" />}
      {hoverField && <Outline el={hoverField.el} label={hoverField.label} />}
      {!editing && section && <InsertPoints info={section.info} el={section.el} />}
      {!editing && section && <RowToolbar info={section.info} el={section.el} variant="block" />}
      {!editing && item && <RowToolbar info={item.info} el={item.el} variant="item" />}
      {!editing && itemList && <AddItem list={itemList} />}
      {!editing && emptyLists.filter((l) => l !== itemList).map((l) => <AddItem key={`${keyOf(l)}|${l.path}`} list={l} />)}
    </>
  );
}
