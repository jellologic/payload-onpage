/**
 * Auto-mapping: tag a document's displayable strings with stega
 * markers (see @payload-onpage/core stega) so the editor can find them on the
 * page. The plugin runs it on reads that ask for it (`context.onpage`);
 * client mode runs it on the editor state it renders.
 *
 * Tagged: text and textarea values, rich-text text nodes, and the `alt` of
 * populated uploads (carrying the parent's upload-field path, so `<img alt>`
 * maps an image). Never tagged: selects, numbers, dates, relationships, JSON,
 * code, and any field whose name suggests machine use (url, slug, email…).
 */
import { stegaEncode, type Marker } from './stega.ts'
import type { SchemaField } from './schema.ts'

export const MACHINE_FIELD_NAME =
  /(url|href|link|path|email|phone|slug|key|token|anchor|^id$|class|style|icon|colou?r|hex)/i

/** Field editors that edit text: a field using any other editor (color, …) holds a machine value and is never marked. */
const TEXT_EDITORS = new Set(['text', 'textarea', 'email', 'richText'])

export type EncodeFilter = (args: { field: SchemaField; path: string; ref: string }) => boolean

interface Ctx {
  ref: string
  filter?: EncodeFilter
}

const allowed = (field: SchemaField, path: string, ctx: Ctx) =>
  !MACHINE_FIELD_NAME.test(field.name) &&
  (!field.editor || TEXT_EDITORS.has(field.editor)) &&
  (ctx.filter ? ctx.filter({ field, path, ref: ctx.ref }) : true)

const mark = (value: string, ctx: Ctx, path: string, kind: Marker['kind']) =>
  stegaEncode(value, { ref: ctx.ref, path, kind })

function encodeRichText(value: any, ctx: Ctx, path: string): any {
  const walk = (node: any): any => {
    if (!node || typeof node !== 'object') return node
    let out = node
    if (node.type === 'text' && typeof node.text === 'string' && node.text)
      out = { ...node, text: mark(node.text, ctx, path, 'richtext') }
    if (Array.isArray(node.children)) out = { ...out, children: node.children.map(walk) }
    return out
  }
  return value?.root ? { ...value, root: walk(value.root) } : value
}

function encodeValue(value: unknown, field: SchemaField, path: string, ctx: Ctx): unknown {
  if (value == null) return value
  switch (field.type) {
    case 'text':
    case 'textarea':
      if (typeof value === 'string' && value && allowed(field, path, ctx))
        return mark(value, ctx, path, field.type === 'textarea' ? 'textarea' : 'text')
      return value
    case 'richText':
      return allowed(field, path, ctx) ? encodeRichText(value, ctx, path) : value
    case 'upload':
      if (!field.hasMany && value && typeof value === 'object' && !Array.isArray(value)) {
        const media = value as Record<string, unknown>
        return {
          ...media,
          alt: mark(typeof media.alt === 'string' ? media.alt : '', ctx, path, 'media'),
        }
      }
      return value
    case 'group':
      return encodeFields(value as Record<string, unknown>, field.fields ?? [], path, ctx)
    case 'array':
      return Array.isArray(value)
        ? value.map((row, i) => encodeFields(row, field.fields ?? [], `${path}.${i}`, ctx))
        : value
    case 'blocks':
      return Array.isArray(value)
        ? value.map((row, i) => {
            const block = field.blocks?.find(
              (b) => b.slug === (row as { blockType?: string })?.blockType,
            )
            return block ? encodeFields(row, block.fields, `${path}.${i}`, ctx) : row
          })
        : value
    default:
      return value
  }
}

function encodeFields(data: unknown, fields: SchemaField[], prefix: string, ctx: Ctx): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data
  const out: Record<string, unknown> = { ...(data as Record<string, unknown>) }
  for (const f of fields) {
    if (!(f.name in out)) continue
    out[f.name] = encodeValue(out[f.name], f, prefix ? `${prefix}.${f.name}` : f.name, ctx)
  }
  return out
}

/** Return a copy of `doc` with markers on the given (editable) top-level fields. */
export function encodeDocument<T extends Record<string, unknown>>(
  doc: T,
  fields: SchemaField[],
  ref: string,
  opts: { only?: string[]; filter?: EncodeFilter } = {},
): T {
  const scope = opts.only ? fields.filter((f) => opts.only!.includes(f.name)) : fields
  return encodeFields(doc, scope, '', { ref, filter: opts.filter }) as T
}
