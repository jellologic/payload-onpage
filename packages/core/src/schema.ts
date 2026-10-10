/**
 * A JSON-safe description of a collection's fields, produced on the server by
 * the plugin's schema endpoint and consumed by the on-page editor to build
 * settings forms, new blocks and save payloads.
 *
 * Payload's own client config strips `defaultValue` (it may be a function), so
 * we serialize our own: static defaults survive, functions are dropped.
 */

export interface SchemaOption {
  label: string
  value: string
}

export interface SchemaField {
  name: string
  type: string
  label: string
  localized?: boolean
  required?: boolean
  hasMany?: boolean
  defaultValue?: unknown
  description?: string
  options?: SchemaOption[]
  relationTo?: string | string[]
  minRows?: number
  maxRows?: number
  /** group / array / named tab */
  fields?: SchemaField[]
  /** blocks */
  blocks?: SchemaBlock[]
  /** Field-editor override: `admin.custom.onpage.editor` (e.g. "color"). */
  editor?: string
  /** Number limits / date picker appearance, when set on the field. */
  min?: number
  max?: number
  pickerAppearance?: string
}

export interface SchemaBlock {
  slug: string
  labels: { singular: string; plural: string }
  fields: SchemaField[]
}

/** The editable shape of one collection or global, as served by the plugin. */
export interface DocumentSchema {
  kind: 'collection' | 'global'
  slug: string
  labels: { singular: string; plural: string }
  /** Top-level field names the editor may change. */
  editable: string[]
  fields: SchemaField[]
  drafts: boolean
  /** Field used as the document's title (collections). */
  useAsTitle?: string
  defaultLocale?: string
  locales?: string[]
}

/** @deprecated use DocumentSchema */
export type CollectionSchema = DocumentSchema

/** "bgColor" → "Bg color", "ctaURL" → "Cta url". */
export function humanize(name: string): string {
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** Payload labels may be a string, a per-locale record, or a function. */
export function labelText(label: unknown, fallback: string, locale = 'en'): string {
  if (typeof label === 'string' && label) return label
  if (label && typeof label === 'object') {
    const rec = label as Record<string, unknown>
    const v = rec[locale] ?? Object.values(rec).find((x) => typeof x === 'string')
    if (typeof v === 'string' && v) return v
  }
  return fallback
}

const isJsonSafe = (v: unknown): boolean => {
  if (v === undefined || typeof v === 'function') return false
  try {
    JSON.stringify(v)
    return true
  } catch {
    return false
  }
}

type AnyField = Record<string, any>

/**
 * Serialize Payload field configs. Presentational containers (row, collapsible,
 * unnamed tabs) are flattened into their parent; `ui` fields are dropped;
 * named tabs become groups.
 */
export function serializeFields(fields: AnyField[] | undefined, locale = 'en'): SchemaField[] {
  const out: SchemaField[] = []
  for (const f of fields ?? []) {
    if (!f || typeof f !== 'object') continue
    if (f.type === 'ui') continue
    if (f.type === 'row' || f.type === 'collapsible' || (f.type === 'group' && !f.name)) {
      out.push(...serializeFields(f.fields, locale))
      continue
    }
    if (f.type === 'tabs') {
      for (const tab of f.tabs ?? []) {
        if (tab.name) {
          out.push({
            name: tab.name,
            type: 'group',
            label: labelText(tab.label, humanize(tab.name), locale),
            fields: serializeFields(tab.fields, locale),
            ...(tab.localized ? { localized: true } : {}),
          })
        } else {
          out.push(...serializeFields(tab.fields, locale))
        }
      }
      continue
    }
    if (!f.name) continue
    const field: SchemaField = {
      name: f.name,
      type: f.type,
      label: labelText(f.label, humanize(f.name), locale),
    }
    if (f.localized) field.localized = true
    if (f.required) field.required = true
    if (f.hasMany) field.hasMany = true
    if (isJsonSafe(f.defaultValue)) field.defaultValue = f.defaultValue
    const description = labelText(f.admin?.description, '', locale)
    if (description) field.description = description
    if (Array.isArray(f.options)) {
      field.options = f.options.map((o: unknown) =>
        typeof o === 'string'
          ? { label: humanize(o), value: o }
          : {
              label: labelText((o as AnyField).label, String((o as AnyField).value), locale),
              value: String((o as AnyField).value),
            },
      )
    }
    if (f.relationTo) field.relationTo = f.relationTo
    if (typeof f.minRows === 'number') field.minRows = f.minRows
    if (typeof f.maxRows === 'number') field.maxRows = f.maxRows
    if (typeof f.min === 'number') field.min = f.min
    if (typeof f.max === 'number') field.max = f.max
    const custom = f.admin?.custom?.onpage?.editor ?? f.custom?.onpage?.editor
    if (typeof custom === 'string') field.editor = custom
    if (typeof f.admin?.date?.pickerAppearance === 'string')
      field.pickerAppearance = f.admin.date.pickerAppearance
    if (f.type === 'group' || f.type === 'array') field.fields = serializeFields(f.fields, locale)
    if (f.type === 'blocks') {
      field.blocks = (f.blocks ?? []).map((b: AnyField) => ({
        slug: b.slug,
        labels: {
          singular: labelText(b.labels?.singular, humanize(b.slug), locale),
          plural: labelText(b.labels?.plural, humanize(b.slug), locale),
        },
        fields: serializeFields(b.fields, locale),
      }))
    }
    out.push(field)
  }
  return out
}
