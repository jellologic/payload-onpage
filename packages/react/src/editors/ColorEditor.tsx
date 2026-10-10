'use client'

import { useState } from 'react'
import type { FieldEditorProps } from '../types.ts'
import { Dialog } from '../ui/Dialog.tsx'

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/** Hex color with a native picker. Use it from a text field: `admin.custom.onpage.editor: 'color'`. */
export function ColorEditor({
  field,
  value,
  element,
  commit,
  preview,
  close,
  live,
  t,
}: FieldEditorProps) {
  const [draft, setDraft] = useState(typeof value === 'string' ? value : '')
  const change = (v: string) => {
    setDraft(v)
    if (live && HEX.test(v)) preview(v)
  }
  const save = () => {
    if (draft !== (value ?? '') && (draft === '' || HEX.test(draft))) commit(draft || null)
    close()
  }
  return (
    <Dialog
      variant="popover"
      anchor={element}
      title={field.label}
      onClose={close}
      t={t}
      width={260}
      testId="onpage-color"
    >
      <div className="po-row po-inline-row">
        <input
          type="color"
          aria-label={field.label}
          value={HEX.test(draft) && draft.length === 7 ? draft : '#000000'}
          onChange={(e) => change(e.target.value)}
          data-testid="onpage-color-picker"
        />
        <input
          className="po-input"
          aria-label={field.label}
          data-autofocus
          value={draft}
          placeholder="#1e40af"
          aria-invalid={draft !== '' && !HEX.test(draft)}
          onChange={(e) => change(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          data-testid="onpage-color-input"
        />
      </div>
      <button type="button" className="po-btn po-primary" onClick={save} data-testid="onpage-apply">
        {t('common.apply')}
      </button>
    </Dialog>
  )
}
