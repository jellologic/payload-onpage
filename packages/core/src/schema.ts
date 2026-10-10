/**
 * A JSON-safe description of a document's editable fields, produced on the
 * server by the plugin's schema endpoint (`@payload-onpage/plugin`) and consumed
 * by the editor to build settings forms, new rows and save payloads.
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
  /** array: what one row and many rows are called (\"Feature\" / \"Features\"). */
  labels?: { singular: string; plural: string }
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
  /** Autosave debounce from the collection's versions config, in ms. */
  autosaveInterval?: number
  /** Collections that relationship fields point to: how to search and show them. */
  relations?: Record<string, { titleField: string; label: string }>
}
