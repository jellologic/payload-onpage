'use client'

/**
 * Settings for one section or item, generated from the schema: every value
 * that isn't edited directly on the page — selects (layout, background, width,
 * spacing…), checkboxes, numbers, dates, relationships, URLs and other plain
 * text, images that aren't on the page. Changes apply immediately.
 */
import {
  fieldAtPath,
  getAt,
  relationTitle,
  rowFieldsOf,
  toText,
  isListField,
  type ChoiceField,
  type NumberField,
  type ScalarField,
  type SchemaField,
  isReady,
  type RefKey,
} from '@payload-onpage/core'
import { useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { useOnPage } from '../context.tsx'
import type { Translate } from '../messages.ts'
import { checkedOf } from '../editors/CheckboxEditor.tsx'
import { selectedValues } from '../editors/SelectEditor.tsx'
import { canEdit } from '../registry.ts'
import { settable } from '../settings.ts'
import { Dialog } from './Dialog.tsx'

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
  docKey: RefKey
  path: string
  field: ScalarField | NumberField
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
  docKey: RefKey
  path: string
  field: ChoiceField
  labelId: string
}) {
  const { session, snap } = useOnPage()
  const options = field.options
  const current =
    selectedValues(getAt(snap.docs[docKey]?.doc, path) ?? field.defaultValue, field)[0] ?? ''
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
  docKey: RefKey
  path: string
  field: SchemaField
  anchor: RefObject<HTMLDivElement | null>
  id: string
  labelId: string
}) {
  const { session, snap, edit, editors, t } = useOnPage()
  const value = getAt(snap.docs[docKey]?.doc, path)
  const set = (v: unknown) => session.setValue(docKey, path, v)
  const openEditor = (
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
  // A field with its own editor (e.g. `editor: 'color'`) opens it, whatever its type.
  if (field.editor && canEdit(editors[field.editor], field)) return openEditor
  switch (field.type) {
    case 'select':
    case 'radio': {
      if (field.hasMany) return openEditor
      if (field.options.length <= 5)
        return <Segmented docKey={docKey} path={path} field={field} labelId={labelId} />
      return (
        <select
          id={id}
          className="po-select"
          value={selectedValues(value ?? field.defaultValue, field)[0] ?? ''}
          onChange={(e) => set(e.target.value || null)}
          data-testid={`onpage-setting-${path}`}
        >
          {!field.required && <option value="">{t('common.none')}</option>}
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
    }
    case 'checkbox':
      return (
        <label className="po-check">
          <input
            type="checkbox"
            checked={checkedOf(value, field)}
            onChange={(e) => set(e.target.checked)}
            data-testid={`onpage-setting-${path}`}
          />
          {field.label}
        </label>
      )
    case 'text':
    case 'textarea':
    case 'email':
    case 'number':
      return 'hasMany' in field && field.hasMany ? (
        openEditor
      ) : (
        <TextInput docKey={docKey} path={path} field={field} id={id} />
      )
    default:
      // Dates, relationships, images…: open the field editor, anchored to the panel row.
      return openEditor
  }
}

function Row({ docKey, path, field }: { docKey: RefKey; path: string; field: SchemaField }) {
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

function Fields({ docKey, fields, path }: { docKey: RefKey; fields: SchemaField[]; path: string }) {
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
                <Fields docKey={docKey} fields={f.fields} path={full} />
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
  if (!isReady(state)) return null
  const owner = fieldAtPath(state.schema.fields, state.doc, panel.path)?.field
  // Row fields: the block's fields for a blocks row, the item fields for an array row.
  const fields =
    owner && isListField(owner) ? (rowFieldsOf(owner, getAt(state.doc, panel.path)) ?? []) : []
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
