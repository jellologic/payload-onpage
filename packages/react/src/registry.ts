/**
 * Field-editor resolution. For a field shown on the page, the editor is:
 *   1. the field's own choice: admin.custom.onpage.editor ("color", "my-editor")
 *   2. what the element says it shows: an annotation/marker kind of text,
 *      textarea, richtext or media
 *   3. the editor registered for the field's type ("select", "date", "json"…)
 * No match: the field isn't edited in place (it may still be in the row's
 * settings panel).
 */
import type { SchemaField, TargetKind } from '@payload-onpage/core'
import type { EditorRegistry } from './types.ts'

const KIND_EDITOR: Partial<Record<TargetKind, string>> = { richtext: 'richText', media: 'upload' }
const TEXTUAL = new Set(['text', 'textarea', 'email'])

export function resolveEditor(
  editors: EditorRegistry,
  field: SchemaField,
  kind?: TargetKind,
): string | null {
  if (field.editor && editors[field.editor]) return field.editor
  // A marker/annotation saying "text" keeps the field's own textual type (email stays email).
  if ((kind === 'text' || kind === 'textarea') && TEXTUAL.has(field.type) && editors[field.type])
    return field.type
  const byKind = kind ? KIND_EDITOR[kind] : undefined
  if (byKind && editors[byKind] && (byKind !== 'upload' || field.type === 'upload')) return byKind
  return editors[field.type] ? field.type : null
}

/** Merge registries left to right; `null` removes a default. */
export function mergeEditors(
  ...regs: Array<Record<string, EditorRegistry[string] | null> | undefined>
): EditorRegistry {
  const out: EditorRegistry = {}
  for (const r of regs) {
    if (!r) continue
    for (const [k, v] of Object.entries(r)) {
      if (v) out[k] = v
      else delete out[k]
    }
  }
  return out
}
