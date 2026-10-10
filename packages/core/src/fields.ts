/**
 * Schema-aware operations on document data: find the field behind a path, build
 * new blocks/rows from defaults, clone rows with fresh ids, and normalize data
 * for saving (populated relations back to ids).
 */
import { getAt, newRowId, parsePath, type PathSegment } from './path.ts'
import { mapLexical } from './lexical.ts'
import type { DocumentSchema, SchemaBlock, SchemaField } from './schema.ts'

export interface FieldAtPath {
  field: SchemaField
  /** The block whose fields contain this field, when inside a blocks row. */
  block?: SchemaBlock
  /** Path of the nearest blocks row ("sections.3"), when inside one. */
  blockPath?: string
}

/** The block a blocks-field row uses (by its `blockType`). */
export const blockFor = (field: SchemaField, row: unknown): SchemaBlock | undefined =>
  field.blocks?.find((b) => b.slug === (row as { blockType?: unknown } | null)?.blockType)

/** May the editor change this path? (Its top-level field must be editable.) */
export const isEditablePath = (schema: DocumentSchema, path: string): boolean =>
  schema.editable.includes(path.split('.')[0] ?? '')

export interface RowInfo {
  /** "layout.2" */
  path: string
  /** "layout" */
  listPath: string
  index: number
  length: number
  listField: SchemaField
  /** Fields of this row: the block's fields, or the array's. */
  rowFields: SchemaField[]
  /** Singular label of one row ("Hero", "Feature"). */
  label: string
  isBlock: boolean
}

/** Everything the editor needs about one row of an array or blocks field, or null if `path` isn't an editable row. */
export function resolveRow(schema: DocumentSchema, doc: unknown, path: string): RowInfo | null {
  const segs = path.split('.')
  const last = segs[segs.length - 1]
  if (!last || !/^\d+$/.test(last) || !isEditablePath(schema, path)) return null
  const listPath = segs.slice(0, -1).join('.')
  const index = Number(last)
  const listField = fieldAtPath(schema.fields, doc, listPath)?.field
  if (!listField || (listField.type !== 'array' && listField.type !== 'blocks')) return null
  const rows = getAt<unknown[]>(doc, listPath) ?? []
  if (index >= rows.length) return null
  const isBlock = listField.type === 'blocks'
  const block = isBlock ? blockFor(listField, rows[index]) : undefined
  return {
    path,
    listPath,
    index,
    length: rows.length,
    listField,
    rowFields: isBlock ? (block?.fields ?? []) : (listField.fields ?? []),
    label: isBlock
      ? (block?.labels.singular ?? 'Section')
      : (listField.labels?.singular ?? listField.label),
    isBlock,
  }
}

/**
 * Walk the schema along `path`, using the document to resolve block types.
 * Returns the field at the end of the path (for an index segment, the array or
 * blocks field that owns the row).
 */
export function fieldAtPath(
  fields: SchemaField[],
  doc: unknown,
  path: string | PathSegment[],
): FieldAtPath | null {
  const segs = parsePath(path)
  let level: SchemaField[] = fields
  let current: SchemaField | undefined
  let block: SchemaBlock | undefined
  let blockPath: string | undefined
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]
    if (typeof seg === 'number') {
      if (!current) return null
      if (current.type === 'blocks') {
        const rowPath = segs.slice(0, i + 1)
        block = blockFor(current, getAt(doc, rowPath))
        if (!block) return null
        blockPath = rowPath.join('.')
        level = block.fields
      } else if (current.type === 'array') {
        level = current.fields ?? []
      } else {
        return null
      }
      continue
    }
    current = level.find((f) => f.name === seg)
    if (!current) return null
    if (current.type === 'group') level = current.fields ?? []
  }
  return current ? { field: current, block, blockPath } : null
}

/** Defaults for a set of fields: static `defaultValue`s, nested groups, `minRows` rows. */
export function defaultsFor(fields: SchemaField[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    if (f.defaultValue !== undefined) {
      out[f.name] = structuredClone(f.defaultValue)
    } else if (f.type === 'group') {
      out[f.name] = defaultsFor(f.fields ?? [])
    } else if (f.type === 'array') {
      out[f.name] = Array.from({ length: f.minRows ?? 0 }, () => newArrayRow(f))
    } else if (f.type === 'blocks') {
      out[f.name] = []
    } else if (f.required && (f.type === 'text' || f.type === 'textarea')) {
      out[f.name] = f.label
    }
  }
  return out
}

export function newArrayRow(arrayField: SchemaField): Record<string, unknown> {
  return { id: newRowId(), ...defaultsFor(arrayField.fields ?? []) }
}

export function newBlockRow(block: SchemaBlock): Record<string, unknown> {
  return { id: newRowId(), blockType: block.slug, ...defaultsFor(block.fields) }
}

/**
 * Deep-clone a row (array item or block) giving it, and every nested row, a new
 * id. Ids of related documents (uploads, relationships) are left alone, so a
 * duplicated card still points at the same image.
 */
export function cloneRow(row: unknown, rowFields: SchemaField[]): unknown {
  if (!row || typeof row !== 'object') return row
  const copy: Record<string, unknown> = { ...(row as Record<string, unknown>), id: newRowId() }
  for (const f of rowFields) copy[f.name] = cloneValue(copy[f.name], f)
  return copy
}

function cloneValue(value: unknown, field: SchemaField): unknown {
  if (value == null) return value
  if (field.type === 'group') {
    const out: Record<string, unknown> = { ...(value as Record<string, unknown>) }
    for (const f of field.fields ?? []) out[f.name] = cloneValue(out[f.name], f)
    return out
  }
  if (field.type === 'array' && Array.isArray(value))
    return (value as unknown[]).map((r: unknown) => cloneRow(r, field.fields ?? []))
  if (field.type === 'blocks' && Array.isArray(value)) {
    return (value as unknown[]).map((r: unknown) => {
      const block = blockFor(field, r)
      return block ? cloneRow(r, block.fields) : structuredClone(r)
    })
  }
  return typeof value === 'object' ? structuredClone(value) : value
}

/** The id of a relationship value: a populated doc, `{ relationTo, value }`, or an id. */
export function relationId(v: unknown): string | number | undefined {
  if (v == null) return undefined
  if (typeof v === 'string' || typeof v === 'number') return v
  if (typeof v !== 'object') return undefined
  const o = v as Record<string, unknown>
  if ('relationTo' in o) return relationId(o.value)
  return o.id as string | number | undefined
}

/** A display title for a relationship value (`titleField` when known, else common title fields, else the id). */
export function relationTitle(v: unknown, titleField?: string): string {
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    if ('relationTo' in o) return relationTitle(o.value, titleField)
    for (const k of [titleField, 'title', 'name', 'label', 'alt', 'filename', 'slug']) {
      if (k && typeof o[k] === 'string' && o[k]) return o[k]
    }
  }
  return String(relationId(v) ?? '')
}

const idOf = (v: unknown): unknown => (v && typeof v === 'object' && 'id' in v ? relationId(v) : v)

function normalizeRelation(value: unknown, field: SchemaField): unknown {
  if (value == null) return value
  const one = (v: unknown) => {
    // Polymorphic: { relationTo, value }
    if (Array.isArray(field.relationTo) && v && typeof v === 'object' && 'relationTo' in v) {
      const p = v as { relationTo: string; value: unknown }
      return { relationTo: p.relationTo, value: idOf(p.value) }
    }
    return idOf(v)
  }
  return Array.isArray(value) ? value.map(one) : one(value)
}

/**
 * Turn rendered (populated) data back into what Payload expects on write:
 * uploads and relationships become ids, everything else passes through.
 */
export function normalizeValue(value: unknown, field: SchemaField): unknown {
  if (value == null) return value
  switch (field.type) {
    case 'upload':
    case 'relationship':
      return normalizeRelation(value, field)
    case 'richText':
      return normalizeRichText(value)
    case 'group': {
      const out: Record<string, unknown> = { ...(value as Record<string, unknown>) }
      for (const f of field.fields ?? [])
        if (f.name in out) out[f.name] = normalizeValue(out[f.name], f)
      return out
    }
    case 'array':
      return Array.isArray(value)
        ? (value as unknown[]).map((row: unknown) => normalizeRow(row, field.fields ?? []))
        : value
    case 'blocks':
      return Array.isArray(value)
        ? (value as unknown[]).map((row: unknown) => {
            const block = blockFor(field, row)
            return block ? normalizeRow(row, block.fields) : row
          })
        : value
    default:
      return value
  }
}

/**
 * Rich text read at depth > 0 has populated relations inside nodes (an upload
 * node's `value`, an internal link's `fields.doc.value`). Payload stores ids, so
 * those go back to ids; nothing else in the tree changes.
 */
export function normalizeRichText(value: unknown): unknown {
  return mapLexical(value, (node) => {
    let out = node
    if ((node.type === 'upload' || node.type === 'relationship') && isPopulated(node.value)) {
      out = { ...out, value: node.value.id }
    }
    const fields = node.fields as { doc?: { value?: unknown } } | undefined
    if (
      (node.type === 'link' || node.type === 'autolink') &&
      fields?.doc &&
      isPopulated(fields.doc.value)
    ) {
      out = { ...out, fields: { ...fields, doc: { ...fields.doc, value: fields.doc.value.id } } }
    }
    return out
  })
}

const isPopulated = (v: unknown): v is { id: string | number } =>
  !!v && typeof v === 'object' && 'id' in v

function normalizeRow(row: unknown, rowFields: SchemaField[]): unknown {
  if (!row || typeof row !== 'object') return row
  const out: Record<string, unknown> = { ...(row as Record<string, unknown>) }
  for (const f of rowFields) if (f.name in out) out[f.name] = normalizeValue(out[f.name], f)
  return out
}

/** Normalize the given top-level keys of a document for a PATCH body. */
export function buildPatch(
  doc: Record<string, unknown>,
  keys: string[],
  fields: SchemaField[],
): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  for (const key of keys) {
    const field = fields.find((f) => f.name === key)
    patch[key] = field ? normalizeValue(doc[key], field) : doc[key]
  }
  return patch
}

/** Top-level keys (from `keys`) whose values differ between two documents. */
export function changedKeys(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
  keys: string[],
): string[] {
  return keys.filter(
    (k) => prev[k] !== next[k] && JSON.stringify(prev[k]) !== JSON.stringify(next[k]),
  )
}

/** A scalar value as editable text: strings and numbers as-is; null, undefined and objects as ''. */
export function toText(value: unknown): string {
  return typeof value === 'string'
    ? value
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : ''
}
