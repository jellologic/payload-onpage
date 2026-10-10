'use client'

/**
 * Settings for one section or item, generated from the schema: every value
 * that isn't edited directly on the page — selects (layout, background, width,
 * spacing…), checkboxes, numbers, dates, relationships, URLs and other plain
 * text, images that aren't on the page. Changes apply immediately.
 */
import { fieldAtPath, getAt, relationTitle, toText, type SchemaField } from '@payload-onpage/core'
import { useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { useOnPage } from '../context.tsx'
import type { Translate } from '../messages.ts'
import type { TargetIndex } from '../types.ts'
import { Dialog } from './Dialog.tsx'

const SKIP = new Set(['id', 'blockType', 'blockName'])
const TEXTUAL = new Set(['text', 'textarea', 'email', 'number', 'date', 'relationship', 'upload'])
const INPUT_TYPES = new Set(['text', 'textarea', 'email', 'number'])

function settable(field: SchemaField, path: string, key: string, targets: TargetIndex): boolean {
  if (SKIP.has(field.name)) return false
  const full = `${path}.${field.name}`
  switch (field.type) {
    case 'select':
    case 'radio':
    case 'checkbox':
      return true
    case 'group':
      return (field.fields ?? []).some((f) => settable(f, full, key, targets))
    default:
      // Shown on the page? Edit it there.
      return TEXTUAL.has(field.type) && !targets.find(key, full)
  }
}

export const hasSettings = (
  fields: SchemaField[],
  path: string,
  key: string,
  targets: TargetIndex,
): boolean => fields.some((f) => settable(f, path, key, targets))

const display = (v: unknown, t: Translate): string => {
  if (v == null || v === '') return t('common.none')
  if (Array.isArray(v))
    return v.length ? t('common.selected', { count: v.length }) : t('common.none')
  return typeof v === 'object' ? relationTitle(v) : toText(v)
}

function TextInput({
  docKey,
  path,
  field,
  id,
}: {
  docKey: string
  path: string
  field: SchemaField
  id: string
}) {
  const { session, snap } = useOnPage()
  const value = getAt(snap.docs[docKey]?.doc, path)
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? toText(value)
  const parse = (v: string) => (field.type === 'number' ? (v === '' ? null : Number(v)) : v)
  const commit = () => {
    if (draft === null) return
    session.setValue(docKey, path, parse(draft))
    setDraft(null)
  }
  return (
    <input
      id={id}
      className="po-input"
      type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
      value={shown}
      onChange={(e) => {
        setDraft(e.target.value)
        session.setValue(docKey, path, parse(e.target.value), { transient: true })
      }}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      data-testid={`onpage-setting-${path}`}
    />
  )
}

/** A radio group with arrow-key navigation (WAI-ARIA radio pattern). */
function Segmented({
  docKey,
  path,
  field,
  labelId,
}: {
  docKey: string
  path: string
  field: SchemaField
  labelId: string
}) {
  const { session, snap } = useOnPage()
  const options = field.options ?? []
  const current = getAt(snap.docs[docKey]?.doc, path) ?? field.defaultValue ?? ''
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === current),
  )
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0
    if (!step) return
    e.preventDefault()
    const next = options[(index + step + options.length) % options.length]
    if (next) session.setValue(docKey, path, next.value)
    const group = e.currentTarget.parentElement
    requestAnimationFrame(() =>
      group?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus(),
    )
  }
  return (
    <div className="po-seg" role="radiogroup" aria-labelledby={labelId}>
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={current === o.value}
          tabIndex={i === index ? 0 : -1}
          onClick={() => session.setValue(docKey, path, o.value)}
          onKeyDown={onKey}
          data-testid={`onpage-setting-${path}-${o.value}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Control({
  docKey,
  path,
  field,
  anchor,
  id,
  labelId,
}: {
  docKey: string
  path: string
  field: SchemaField
  anchor: RefObject<HTMLDivElement | null>
  id: string
  labelId: string
}) {
  const { session, snap, edit, t } = useOnPage()
  const value = getAt(snap.docs[docKey]?.doc, path)
  const set = (v: unknown) => session.setValue(docKey, path, v)
  if ((field.type === 'select' || field.type === 'radio') && !field.hasMany) {
    const options = field.options ?? []
    if (options.length <= 5)
      return <Segmented docKey={docKey} path={path} field={field} labelId={labelId} />
    return (
      <select
        id={id}
        className="po-select"
        value={toText(value ?? field.defaultValue)}
        onChange={(e) => set(e.target.value || null)}
        data-testid={`onpage-setting-${path}`}
      >
        {!field.required && <option value="">{t('common.none')}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    )
  }
  if (field.type === 'checkbox') {
    return (
      <label className="po-check">
        <input
          type="checkbox"
          checked={Boolean(value ?? field.defaultValue)}
          onChange={(e) => set(e.target.checked)}
          data-testid={`onpage-setting-${path}`}
        />
        {field.label}
      </label>
    )
  }
  if (INPUT_TYPES.has(field.type))
    return <TextInput docKey={docKey} path={path} field={field} id={id} />
  // Everything else opens its field editor, anchored to the panel row.
  return (
    <button
      id={id}
      type="button"
      className="po-input po-picker"
      onClick={() => edit(docKey, path, { anchor: anchor.current ?? undefined })}
      data-testid={`onpage-setting-${path}`}
    >
      {field.type === 'upload'
        ? t(value ? 'settings.changeImage' : 'settings.chooseImage')
        : display(value, t)}
    </button>
  )
}

function Row({ docKey, path, field }: { docKey: string; path: string; field: SchemaField }) {
  const anchor = useRef<HTMLDivElement>(null)
  const id = useId()
  const labelId = `${id}-label`
  return (
    <div className="po-row" ref={anchor}>
      {field.type !== 'checkbox' && (
        <label id={labelId} htmlFor={id}>
          {field.label}
        </label>
      )}
      <Control
        docKey={docKey}
        path={path}
        field={field}
        anchor={anchor}
        id={id}
        labelId={labelId}
      />
      {field.description && <small>{field.description}</small>}
    </div>
  )
}

function Fields({ docKey, fields, path }: { docKey: string; fields: SchemaField[]; path: string }) {
  const { targets } = useOnPage()
  return (
    <>
      {fields
        .filter((f) => settable(f, path, docKey, targets))
        .map((f) => {
          const full = `${path}.${f.name}`
          if (f.type === 'group') {
            return (
              <fieldset key={f.name} className="po-group">
                <legend className="po-h4">{f.label}</legend>
                <Fields docKey={docKey} fields={f.fields ?? []} path={full} />
              </fieldset>
            )
          }
          return <Row key={f.name} docKey={docKey} path={full} field={f} />
        })}
    </>
  )
}

export function SettingsPanel() {
  const { panel, setPanel, snap, t } = useOnPage()
  if (panel?.kind !== 'settings') return null
  const state = snap.docs[panel.key]
  if (!state?.schema || !state.doc) return null
  const owner = fieldAtPath(state.schema.fields, state.doc, panel.path)
  // Row fields: the block's fields for a blocks row, the item fields for an array row.
  const fields =
    owner?.field.type === 'blocks' ? (owner.block?.fields ?? []) : (owner?.field.fields ?? [])
  return (
    <Dialog
      variant="panel"
      title={t('settings.title', { label: panel.title })}
      onClose={() => setPanel(null)}
      t={t}
      testId="onpage-settings"
    >
      <Fields docKey={panel.key} fields={fields} path={panel.path} />
    </Dialog>
  )
}
