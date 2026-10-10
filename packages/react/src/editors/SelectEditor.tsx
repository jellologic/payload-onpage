'use client'

import { toText } from '@payload-onpage/core'
import type { FieldEditorProps } from '../types.ts'
import { Dialog } from '../ui/Dialog.tsx'

/** Select / radio: pick one (closes) or toggle several (hasMany). */
export function SelectEditor({ field, value, element, commit, close, t }: FieldEditorProps) {
  const options = field.options ?? []
  const many = !!field.hasMany
  const current: string[] = many
    ? Array.isArray(value)
      ? (value as string[])
      : []
    : value == null
      ? []
      : [toText(value)]
  const pick = (v: string | null) => {
    if (!many) {
      commit(v)
      close()
      return
    }
    const set = new Set(current)
    if (v === null) set.clear()
    else if (set.has(v)) set.delete(v)
    else set.add(v)
    commit(options.map((o) => o.value).filter((o) => set.has(o)))
  }
  return (
    <Dialog
      variant="popover"
      anchor={element}
      title={field.label}
      onClose={close}
      t={t}
      testId="onpage-select"
    >
      <div
        className="po-pop-list"
        role="listbox"
        aria-multiselectable={many}
        aria-label={field.label}
      >
        {!field.required && !many && (
          <button
            type="button"
            role="option"
            aria-selected={!current.length}
            onClick={() => pick(null)}
          >
            {t('common.none')}
          </button>
        )}
        {options.map((o) => {
          const selected = current.includes(o.value)
          return (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => pick(o.value)}
              data-testid={`onpage-option-${o.value}`}
            >
              {many ? (selected ? '☑ ' : '☐ ') : ''}
              {o.label}
            </button>
          )
        })}
      </div>
    </Dialog>
  )
}
