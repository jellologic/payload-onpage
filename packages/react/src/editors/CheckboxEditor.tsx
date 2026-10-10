'use client'

import type { FieldEditorProps } from '../types.ts'
import { Dialog } from '../ui/Dialog.tsx'

export function CheckboxEditor({ field, value, element, commit, close, t }: FieldEditorProps) {
  return (
    <Dialog
      variant="popover"
      anchor={element}
      title={field.label}
      onClose={close}
      t={t}
      testId="onpage-checkbox"
    >
      <label className="po-check">
        <input
          type="checkbox"
          data-autofocus
          checked={Boolean(value ?? field.defaultValue)}
          onChange={(e) => {
            commit(e.target.checked)
            close()
          }}
          data-testid="onpage-checkbox-input"
        />
        {field.label}
      </label>
    </Dialog>
  )
}
