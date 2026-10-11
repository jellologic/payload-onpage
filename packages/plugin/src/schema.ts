/**
 * Builds the editor's JSON schema from Payload field configs, using Payload's
 * own field predicates and translations. Payload's client config can't be used
 * instead: it strips `defaultValue` and `custom`, which the editor needs.
 */
import { getTranslation } from '@payloadcms/translations'
import type { DocumentSchema, SchemaBlock, SchemaField } from '@payload-onpage/core'
import type { Block, Field, PayloadRequest, SanitizedFieldsPermissions } from 'payload'
import { getDefaultValue } from 'payload'
import {
  fieldAffectsData,
  fieldIsHiddenOrDisabled,
  fieldIsVirtual,
  tabHasName,
  formatLabels,
  toWords,
} from 'payload/shared'

/** Fields Payload manages itself; never editable on the page. */
const SYSTEM_FIELDS = new Set(['id', 'createdAt', 'updatedAt', '_status', 'deletedAt'])
/** Data fields with no meaningful on-page value. */
const SKIP_TYPES = new Set(['join', 'ui'])

/** The optional, type-specific field properties the serializer reads. */
interface LooseField {
  label?: unknown
  labels?: { singular?: unknown; plural?: unknown }
  localized?: boolean
  required?: boolean
  hasMany?: boolean
  defaultValue?: unknown
  options?: unknown[]
  relationTo?: string | string[]
  minRows?: number
  maxRows?: number
  min?: number
  max?: number
  custom?: { onpage?: { editor?: unknown } }
  admin?: {
    description?: unknown
    custom?: { onpage?: { editor?: unknown } }
    date?: { pickerAppearance?: unknown }
  }
}

type I18nLike = Parameters<typeof getTranslation>[1]
type AnyLabel = Parameters<typeof getTranslation>[0]
type Permissions = SanitizedFieldsPermissions | undefined

export interface SerializeContext {
  /** Translates labels into the admin language. Without it, plain-string labels or the field name are used. */
  i18n?: I18nLike
  /** Global blocks (`config.blocks`), to resolve `blockReferences`. */
  blocks?: Block[]
  /** Field-level permissions: fields the user can't update are left out. */
  permissions?: Permissions
  /** Collects function defaults to evaluate for this request. */
  defaults?: { req: PayloadRequest; pending: Promise<void>[] }
}

/** A config label (string, translations or function) in the request's language, else `fallback`. */
export const label = (
  value: unknown,
  fallback: string,
  ctx: Pick<SerializeContext, 'i18n'>,
): string => {
  if (value == null || value === false) return fallback
  if (typeof value === 'string') return value || fallback
  if (!ctx.i18n) return fallback
  try {
    const out = getTranslation(value as AnyLabel, ctx.i18n)
    return typeof out === 'string' && out ? out : fallback
  } catch {
    return fallback
  }
}

/** Sanitized permissions: `true` = everything; a missing entry = denied. */
function childPermissions(perms: Permissions, name: string): Permissions | false {
  if (perms === undefined || perms === true) return perms
  const entry = perms[name]
  if (!entry) return false
  if (entry === true) return true
  if (entry.update !== true) return false
  return entry.fields ?? true
}

function blockPermissions(perms: Permissions, name: string, slug: string): Permissions {
  if (perms === undefined || perms === true) return perms
  const entry = perms[name]
  if (!entry || entry === true) return true
  const block = (
    entry.blocks as Record<string, { fields?: Permissions } | true | undefined> | undefined
  )?.[slug]
  // No block-level rule: the blocks field's own permission (already checked) applies.
  if (!block || block === true) return true
  return block.fields ?? true
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

function serializeBlock(block: Block, perms: Permissions, ctx: SerializeContext): SchemaBlock {
  return {
    slug: block.slug,
    labels: {
      singular: label(block.labels?.singular, toWords(block.slug), ctx),
      plural: label(block.labels?.plural, toWords(block.slug), ctx),
    },
    fields: serializeFields(block.fields, { ...ctx, permissions: perms }),
  }
}

/**
 * Serialize Payload field configs into the editor schema. Presentational
 * containers (row, collapsible, unnamed group/tab) are flattened into their
 * parent; named tabs become groups; hidden, disabled, virtual, system and
 * join/ui fields are left out.
 */
export function serializeFields(
  fields: Field[] | undefined,
  ctx: SerializeContext = {},
): SchemaField[] {
  const out: SchemaField[] = []
  for (const f of fields ?? []) {
    if (!f || typeof f !== 'object' || SKIP_TYPES.has(f.type)) continue
    if (f.type === 'tabs') {
      for (const tab of f.tabs ?? []) {
        if (!tabHasName(tab)) {
          out.push(...serializeFields(tab.fields, ctx))
          continue
        }
        const perms = childPermissions(ctx.permissions, tab.name)
        if (perms === false) continue
        out.push({
          name: tab.name,
          type: 'group',
          label: label(tab.label, toWords(tab.name), ctx),
          fields: serializeFields(tab.fields, { ...ctx, permissions: perms }),
          ...(tab.localized ? { localized: true } : {}),
        })
      }
      continue
    }
    if (!fieldAffectsData(f)) {
      // row, collapsible, unnamed group: their children belong to the parent.
      if ('fields' in f && Array.isArray(f.fields)) out.push(...serializeFields(f.fields, ctx))
      continue
    }
    // Hidden from the admin (admin.hidden) or the API (hidden), disabled, virtual: not editable here either.
    if (
      SYSTEM_FIELDS.has(f.name) ||
      fieldIsHiddenOrDisabled(f) ||
      fieldIsVirtual(f) ||
      f.admin?.hidden
    )
      continue
    const perms = childPermissions(ctx.permissions, f.name)
    if (perms === false) continue

    // Field is a large union; read the optional, type-specific properties through one loose view.
    const anyField = f as unknown as LooseField
    const field: SchemaField = {
      name: f.name,
      type: f.type,
      label: label(anyField.label, toWords(f.name), ctx),
    }
    if (anyField.localized) field.localized = true
    if (anyField.required) field.required = true
    if (anyField.hasMany) field.hasMany = true
    if (typeof anyField.defaultValue === 'function') {
      if (ctx.defaults) {
        const { req, pending } = ctx.defaults
        pending.push(
          getDefaultValue({
            defaultValue: anyField.defaultValue,
            locale: req.locale ?? undefined,
            req,
            user: req.user,
          })
            .then((v) => {
              if (isJsonSafe(v)) field.defaultValue = v
            })
            .catch(() => undefined),
        )
      }
    } else if (isJsonSafe(anyField.defaultValue)) {
      field.defaultValue = anyField.defaultValue
    }
    const description = label(anyField.admin?.description, '', ctx)
    if (description) field.description = description
    if (Array.isArray(anyField.options)) {
      field.options = anyField.options.map((o: unknown) =>
        typeof o === 'string'
          ? { label: o, value: o }
          : {
              label: label(
                (o as { label?: unknown }).label,
                String((o as { value: unknown }).value),
                ctx,
              ),
              value: String((o as { value: unknown }).value),
            },
      )
    }
    if (anyField.relationTo) field.relationTo = anyField.relationTo
    for (const k of ['minRows', 'maxRows', 'min', 'max'] as const) {
      const n = anyField[k]
      if (typeof n === 'number') field[k] = n
    }
    const editor = anyField.admin?.custom?.onpage?.editor ?? anyField.custom?.onpage?.editor
    if (typeof editor === 'string') field.editor = editor
    const picker = anyField.admin?.date?.pickerAppearance
    if (typeof picker === 'string') field.pickerAppearance = picker
    const childCtx = { ...ctx, permissions: perms }
    if (f.type === 'group' || f.type === 'array') field.fields = serializeFields(f.fields, childCtx)
    if (f.type === 'array') {
      const fallback = formatLabels(f.name)
      field.labels = {
        singular: label(anyField.labels?.singular, fallback.singular, ctx),
        plural: label(anyField.labels?.plural, fallback.plural, ctx),
      }
    }
    if (f.type === 'blocks') {
      const refs = (f.blockReferences ?? [])
        .map((b) => (typeof b === 'string' ? ctx.blocks?.find((x) => x.slug === b) : b))
        .filter((b): b is Block => !!b)
      field.blocks = [...(f.blocks ?? []), ...refs].map((b) =>
        serializeBlock(b, blockPermissions(ctx.permissions, f.name, b.slug), ctx),
      )
    }
    out.push(field)
  }
  return out
}

/** Every collection a relationship or upload field in `fields` points to. */
export function relationTargets(fields: SchemaField[], into = new Set<string>()): Set<string> {
  for (const f of fields) {
    if ((f.type === 'relationship' || f.type === 'upload') && f.relationTo) {
      for (const slug of Array.isArray(f.relationTo) ? f.relationTo : [f.relationTo]) into.add(slug)
    }
    if (f.fields) relationTargets(f.fields, into)
    for (const b of f.blocks ?? []) relationTargets(b.fields, into)
  }
  return into
}

export type { DocumentSchema }
