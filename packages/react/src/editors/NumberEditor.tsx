'use client'

import { toText } from '@payload-onpage/core'
import { useState } from 'react'
import type { FieldEditorProps } from '../types.ts'
import { Dialog } from '../ui/Dialog.tsx'

/** Number input, with a slider when the field has min and max. */
export function NumberEditor({
  field,
  value,
  element,
  commit,
  preview,
  close,
  live,
  t,
}: FieldEditorProps) {
  const [draft, setDraft] = useState(toText(value))
  const slider = field.min !== undefined && field.max !== undefined
  const save = () => {
    const next = draft === '' ? null : Number(draft)
    if (next !== value && (next === null || !Number.isNaN(next))) commit(next)
    close()
  }
  const change = (v: string) => {
    setDraft(v)
    if (live && v !== '' && !Number.isNaN(Number(v))) preview(Number(v))
  }
  return (
    <Dialog
      variant="popover"
      anchor={element}
      title={field.label}
      onClose={close}
      t={t}
      testId="onpage-number"
    >
      <div className="po-row">
        {slider && (
          <input
            type="range"
            aria-label={field.label}
            min={field.min}
            max={field.max}
            value={draft || field.min}
            onChange={(e) => change(e.target.value)}
            data-testid="onpage-number-slider"
          />
        )}
        <input
          className="po-input"
          type="number"
          aria-label={field.label}
          data-autofocus
          min={field.min}
          max={field.max}
          value={draft}
          onChange={(e) => change(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          data-testid="onpage-number-input"
        />
      </div>
      <button type="button" className="po-btn po-primary" onClick={save} data-testid="onpage-apply">
        {t('common.apply')}
      </button>
    </Dialog>
  )
}
