'use client';

/**
 * Popover editors for value fields: select/radio, checkbox, number, date and
 * color. Each commits on a decisive action (pick, toggle, Enter/blur) and
 * closes; Escape or an outside click closes without changes.
 */
import React, { useState } from 'react';
import type { FieldEditorProps } from '../context.tsx';
import { Popover } from './Popover.tsx';

export function SelectEditor({ field, value, element, commit, close }: FieldEditorProps) {
  const options = field.options ?? [];
  const many = !!field.hasMany;
  const current = many ? (Array.isArray(value) ? (value as string[]) : []) : value;
  const pick = (v: string | null) => {
    if (many) {
      const set = new Set(current as string[]);
      if (v === null) set.clear();
      else if (set.has(v)) set.delete(v);
      else set.add(v);
      commit(options.map((o) => o.value).filter((o) => set.has(o)));
      return;
    }
    commit(v);
    close();
  };
  return (
    <Popover anchor={element} title={field.label} onClose={close} testId="onpage-select">
      <div className="po-pop-list" role="listbox" aria-multiselectable={many}>
        {!field.required && !many && (
          <button type="button" role="option" aria-selected={current == null || current === ''} onClick={() => pick(null)}>
            —
          </button>
        )}
        {options.map((o) => {
          const selected = many ? (current as string[]).includes(o.value) : current === o.value;
          return (
            <button key={o.value} type="button" role="option" aria-selected={selected} onClick={() => pick(o.value)} data-testid={`onpage-option-${o.value}`}>
              {many ? (selected ? '☑ ' : '☐ ') : ''}
              {o.label}
            </button>
          );
        })}
      </div>
    </Popover>
  );
}

export function CheckboxEditor({ field, value, element, commit, close }: FieldEditorProps) {
  return (
    <Popover anchor={element} title={field.label} onClose={close} testId="onpage-checkbox">
      <label className="po-check">
        <input
          type="checkbox"
          checked={Boolean(value ?? field.defaultValue)}
          autoFocus
          onChange={(e) => {
            commit(e.target.checked);
            close();
          }}
          data-testid="onpage-checkbox-input"
        />
        {field.label}
      </label>
    </Popover>
  );
}

function useDraft(value: unknown) {
  return useState(value == null ? '' : String(value));
}

export function NumberEditor({ field, value, element, commit, preview, close, live }: FieldEditorProps) {
  const [draft, setDraft] = useDraft(value);
  const slider = field.min !== undefined && field.max !== undefined;
  const save = () => {
    const next = draft === '' ? null : Number(draft);
    if (next !== value && (next === null || !Number.isNaN(next))) commit(next);
    close();
  };
  const change = (v: string) => {
    setDraft(v);
    if (live && v !== '' && !Number.isNaN(Number(v))) preview(Number(v));
  };
  return (
    <Popover anchor={element} title={field.label} onClose={close} testId="onpage-number">
      <div className="po-row">
        {slider && <input type="range" min={field.min} max={field.max} value={draft || field.min} onChange={(e) => change(e.target.value)} data-testid="onpage-number-slider" />}
        <input
          className="po-input"
          type="number"
          min={field.min}
          max={field.max}
          value={draft}
          autoFocus
          onChange={(e) => change(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          data-testid="onpage-number-input"
        />
      </div>
      <button type="button" className="po-btn" style={{ background: '#4f7cff' }} onClick={save} data-testid="onpage-apply">
        Apply
      </button>
    </Popover>
  );
}

/** Payload stores dates as ISO strings; the input works in local time. */
const toLocalInput = (iso: unknown, withTime: boolean): string => {
  if (typeof iso !== 'string' || !iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return withTime ? `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
};

export function DateEditor({ field, value, element, commit, close }: FieldEditorProps) {
  const withTime = field.pickerAppearance === 'dayAndTime' || field.pickerAppearance === 'timeOnly';
  const [draft, setDraft] = useState(toLocalInput(value, withTime));
  const save = () => {
    // Date-only values are stored at local noon, which survives any timezone shift (Payload's own picker does the same).
    const next = draft ? new Date(withTime ? draft : `${draft}T12:00:00`).toISOString() : null;
    if (next !== value) commit(next);
    close();
  };
  return (
    <Popover anchor={element} title={field.label} onClose={close} testId="onpage-date">
      <div className="po-row">
        <input className="po-input" type={withTime ? 'datetime-local' : 'date'} value={draft} autoFocus onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} data-testid="onpage-date-input" />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" className="po-btn" style={{ background: '#4f7cff' }} onClick={save} data-testid="onpage-apply">
          Apply
        </button>
        {!field.required && (
          <button type="button" className="po-btn" style={{ color: '#0f172a' }} onClick={() => setDraft('')}>
            Clear
          </button>
        )}
      </div>
    </Popover>
  );
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function ColorEditor({ field, value, element, commit, preview, close, live }: FieldEditorProps) {
  const [draft, setDraft] = useDraft(value);
  const change = (v: string) => {
    setDraft(v);
    if (live && HEX.test(v)) preview(v);
  };
  const save = () => {
    if (draft !== (value ?? '') && (draft === '' || HEX.test(draft))) commit(draft || null);
    close();
  };
  return (
    <Popover anchor={element} title={field.label} onClose={close} width={260} testId="onpage-color">
      <div className="po-row" style={{ flexDirection: 'row', alignItems: 'center' }}>
        <input type="color" value={HEX.test(draft) && draft.length === 7 ? draft : '#000000'} onChange={(e) => change(e.target.value)} data-testid="onpage-color-picker" />
        <input className="po-input" value={draft} placeholder="#1e40af" autoFocus onChange={(e) => change(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} data-testid="onpage-color-input" />
      </div>
      <button type="button" className="po-btn" style={{ background: '#4f7cff' }} onClick={save} data-testid="onpage-apply">
        Apply
      </button>
    </Popover>
  );
}
