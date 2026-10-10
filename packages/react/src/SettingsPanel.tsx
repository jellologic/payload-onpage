'use client';

/**
 * Settings for one section or item, generated from the schema: every value
 * that isn't edited directly on the page — selects (layout, background, width,
 * spacing…), checkboxes, numbers, dates, relationships, URLs and other plain
 * text, images that aren't on the page. Changes apply immediately.
 */
import React, { useState } from 'react';
import { fieldAtPath, getAt, type SchemaField } from '@payload-onpage/core';
import { useOnPage, type TargetIndex } from './context.tsx';

const SKIP = new Set(['id', 'blockType', 'blockName']);
const TEXTUAL = new Set(['text', 'textarea', 'email', 'number', 'date', 'relationship', 'upload']);

function settable(field: SchemaField, path: string, key: string, targets: TargetIndex): boolean {
  if (SKIP.has(field.name)) return false;
  const full = `${path}.${field.name}`;
  switch (field.type) {
    case 'select':
    case 'radio':
    case 'checkbox':
      return true;
    case 'group':
      return (field.fields ?? []).some((f) => settable(f, full, key, targets));
    default:
      // Shown on the page? Edit it there.
      return TEXTUAL.has(field.type) && !targets.find(key, full);
  }
}

export function hasSettings(fields: SchemaField[], path: string, key: string, targets: TargetIndex): boolean {
  return fields.some((f) => settable(f, path, key, targets));
}

const display = (v: unknown): string => {
  if (v == null || v === '') return '—';
  if (Array.isArray(v)) return v.length ? `${v.length} selected` : '—';
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('relationTo' in o) return display(o.value);
    return String(o.title ?? o.name ?? o.alt ?? o.filename ?? o.id ?? '…');
  }
  return String(v);
};

function TextInput({ docKey, path, field }: { docKey: string; path: string; field: SchemaField }) {
  const { session, snap } = useOnPage();
  const value = getAt(snap.docs[docKey]?.doc, path);
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value == null ? '' : String(value));
  const parse = (v: string) => (field.type === 'number' ? (v === '' ? null : Number(v)) : v);
  const commit = () => {
    if (draft === null) return;
    session.setValue(docKey, path, parse(draft));
    setDraft(null);
  };
  return (
    <input
      className="po-input"
      type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
      value={shown}
      onChange={(e) => {
        setDraft(e.target.value);
        session.setValue(docKey, path, parse(e.target.value), { transient: true });
      }}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      data-testid={`onpage-setting-${path}`}
    />
  );
}

function Control({ docKey, path, field, anchor }: { docKey: string; path: string; field: SchemaField; anchor: React.RefObject<HTMLDivElement | null> }) {
  const { session, snap, edit } = useOnPage();
  const value = getAt(snap.docs[docKey]?.doc, path);
  const set = (v: unknown) => session.setValue(docKey, path, v);
  if (field.type === 'select' || field.type === 'radio') {
    const options = field.options ?? [];
    const current = value ?? field.defaultValue ?? '';
    if (options.length <= 5 && !field.hasMany) {
      return (
        <div className="po-seg" role="radiogroup" aria-label={field.label}>
          {options.map((o) => (
            <button key={o.value} type="button" aria-pressed={current === o.value} onClick={() => set(o.value)} data-testid={`onpage-setting-${path}-${o.value}`}>
              {o.label}
            </button>
          ))}
        </div>
      );
    }
    if (!field.hasMany) {
      return (
        <select className="po-select" value={String(current)} onChange={(e) => set(e.target.value || null)} data-testid={`onpage-setting-${path}`}>
          {!field.required && <option value="">—</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
  }
  if (field.type === 'checkbox') {
    return (
      <label className="po-check">
        <input type="checkbox" checked={Boolean(value ?? field.defaultValue)} onChange={(e) => set(e.target.checked)} data-testid={`onpage-setting-${path}`} />
        {field.label}
      </label>
    );
  }
  if (field.type === 'text' || field.type === 'textarea' || field.type === 'email' || field.type === 'number') {
    return <TextInput docKey={docKey} path={path} field={field} />;
  }
  // Everything else opens its field editor, anchored to the panel row.
  return (
    <button
      type="button"
      className="po-input"
      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
      onClick={() => edit(docKey, path, { anchor: anchor.current ?? undefined })}
      data-testid={`onpage-setting-${path}`}
    >
      {field.type === 'upload' ? (value ? 'Change image…' : 'Choose image…') : display(value)}
    </button>
  );
}

function Row({ docKey, path, field }: { docKey: string; path: string; field: SchemaField }) {
  const anchor = React.useRef<HTMLDivElement>(null);
  return (
    <div className="po-row" ref={anchor}>
      {field.type !== 'checkbox' && <label>{field.label}</label>}
      <Control docKey={docKey} path={path} field={field} anchor={anchor} />
      {field.description && <small>{field.description}</small>}
    </div>
  );
}

function Fields({ docKey, fields, path }: { docKey: string; fields: SchemaField[]; path: string }) {
  const { targets } = useOnPage();
  return (
    <>
      {fields
        .filter((f) => settable(f, path, docKey, targets))
        .map((f) => {
          const full = `${path}.${f.name}`;
          if (f.type === 'group') {
            return (
              <div key={f.name}>
                <div className="po-h4">{f.label}</div>
                <Fields docKey={docKey} fields={f.fields ?? []} path={full} />
              </div>
            );
          }
          return <Row key={f.name} docKey={docKey} path={full} field={f} />;
        })}
    </>
  );
}

export function SettingsPanel() {
  const { panel, setPanel, snap } = useOnPage();
  if (panel?.kind !== 'settings') return null;
  const state = snap.docs[panel.key];
  if (!state?.schema || !state.doc) return null;
  const { path, title } = panel;
  const owner = fieldAtPath(state.schema.fields, state.doc, path);
  // Row fields: the block's fields for a blocks row, the item fields for an array row.
  const fields = owner?.field.type === 'blocks' ? owner.block?.fields ?? [] : owner?.field.fields ?? [];
  return (
    <div className="po-panel" style={{ top: 72, right: 16 }} role="dialog" aria-label={`${title} settings`} data-testid="onpage-settings">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
        <div className="po-h3" style={{ flex: 1, margin: 0 }}>{title}</div>
        <button className="po-btn" style={{ color: '#0f172a' }} onClick={() => setPanel(null)} aria-label="Close settings" data-testid="onpage-settings-close">
          ✕
        </button>
      </div>
      <Fields docKey={panel.key} fields={fields} path={path} />
    </div>
  );
}
