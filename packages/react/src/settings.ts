/**
 * Which fields of a row appear in its settings panel: values that aren't edited
 * on the page itself (layout selects, toggles, numbers, links, images that
 * aren't shown…). Fields shown on the page are edited there instead.
 */
import type { SchemaField, SchemaFieldType } from '@payload-onpage/core'
import type { TargetIndex } from './types.ts'

/** Row bookkeeping, never a setting. */
const SKIP = new Set(['id', 'blockType', 'blockName'])

/** Types shown in the panel when the page doesn't show them (choices and toggles always are). */
const PANEL_FIELD_TYPES: ReadonlySet<SchemaFieldType> = new Set([
  'text',
  'textarea',
  'email',
  'number',
  'date',
  'relationship',
  'upload',
])

export function settable(
  field: SchemaField,
  path: string,
  key: string,
  targets: TargetIndex,
): boolean {
  if (SKIP.has(field.name)) return false
  const full = `${path}.${field.name}`
  switch (field.type) {
    case 'select':
    case 'radio':
    case 'checkbox':
      return true
    case 'group':
      return field.fields.some((f) => settable(f, full, key, targets))
    default:
      // Shown on the page? Edit it there.
      return PANEL_FIELD_TYPES.has(field.type) && !targets.find(key, full)
  }
}

export const hasSettings = (
  fields: SchemaField[],
  path: string,
  key: string,
  targets: TargetIndex,
): boolean => fields.some((f) => settable(f, path, key, targets))
