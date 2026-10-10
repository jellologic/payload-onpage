'use client'

import { useState } from 'react'
import type { FieldEditorProps } from '../types.ts'
import { Dialog } from '../ui/Dialog.tsx'

/** Payload stores dates as ISO strings; the input works in local time. */
const toLocalInput = (iso: unknown, withTime: boolean): string => {
  if (typeof iso !== 'string' || !iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return withTime ? `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}` : date
}

export function DateEditor({ field, value, element, commit, close, t }: FieldEditorProps) {
  const withTime = field.pickerAppearance === 'dayAndTime' || field.pickerAppearance === 'timeOnly'
  const [draft, setDraft] = useState(toLocalInput(value, withTime))
  const save = () => {
    // Date-only values are stored at local noon, which survives any timezone shift (as Payload's picker does).
    const next = draft ? new Date(withTime ? draft : `${draft}T12:00:00`).toISOString() : null
    if (next !== value) commit(next)
    close()
  }
  return (
    <Dialog
      variant="popover"
      anchor={element}
      title={field.label}
      onClose={close}
      t={t}
      testId="onpage-date"
    >
      <div className="po-row">
        <input
          className="po-input"
          type={withTime ? 'datetime-local' : 'date'}
          aria-label={field.label}
          data-autofocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          data-testid="onpage-date-input"
        />
      </div>
      <div className="po-actions">
        <button
          type="button"
          className="po-btn po-primary"
          onClick={save}
          data-testid="onpage-apply"
        >
          {t('common.apply')}
        </button>
        {!field.required && (
          <button type="button" className="po-btn" onClick={() => setDraft('')}>
            {t('common.clear')}
          </button>
        )}
      </div>
    </Dialog>
  )
}
