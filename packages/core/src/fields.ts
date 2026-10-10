/**
 * Schema-aware operations on document data: find the field behind a path, build
 * new blocks/rows from defaults, clone rows with fresh ids, and normalize data
 * for saving (populated relations back to ids).
 */
import { getAt, newRowId, parsePath, type PathSegment } from "./path.ts";
import type { SchemaBlock, SchemaField } from "./schema.ts";

export interface FieldAtPath {
  field: SchemaField;
  /** The block whose fields contain this field, when inside a blocks row. */
  block?: SchemaBlock;
  /** Path of the nearest blocks row ("sections.3"), when inside one. */
  blockPath?: string;
}

/**
 * Walk the schema along `path`, using the document to resolve block types.
 * Returns the field at the end of the path (for an index segment, the array or
 * blocks field that owns the row).
 */
export function fieldAtPath(fields: SchemaField[], doc: unknown, path: string | PathSegment[]): FieldAtPath | null {
  const segs = parsePath(path);
  let level: SchemaField[] = fields;
  let current: SchemaField | undefined;
  let block: SchemaBlock | undefined;
  let blockPath: string | undefined;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (typeof seg === "number") {
      if (!current) return null;
      if (current.type === "blocks") {
        const rowPath = segs.slice(0, i + 1);
        const blockType = getAt<string>(doc, [...rowPath, "blockType"]);
        block = current.blocks?.find((b) => b.slug === blockType);
        if (!block) return null;
        blockPath = rowPath.join(".");
        level = block.fields;
      } else if (current.type === "array") {
        level = current.fields ?? [];
      } else {
        return null;
      }
      continue;
    }
    current = level.find((f) => f.name === seg);
    if (!current) return null;
    if (current.type === "group") level = current.fields ?? [];
  }
  return current ? { field: current, block, blockPath } : null;
}

/** Defaults for a set of fields: static `defaultValue`s, nested groups, `minRows` rows. */
export function defaultsFor(fields: SchemaField[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.defaultValue !== undefined) {
      out[f.name] = structuredClone(f.defaultValue);
    } else if (f.type === "group") {
      out[f.name] = defaultsFor(f.fields ?? []);
    } else if (f.type === "array") {
      out[f.name] = Array.from({ length: f.minRows ?? 0 }, () => newArrayRow(f));
    } else if (f.type === "blocks") {
      out[f.name] = [];
    } else if (f.required && (f.type === "text" || f.type === "textarea")) {
      out[f.name] = f.label;
    }
  }
  return out;
}

export function newArrayRow(arrayField: SchemaField): Record<string, unknown> {
  return { id: newRowId(), ...defaultsFor(arrayField.fields ?? []) };
}

export function newBlockRow(block: SchemaBlock): Record<string, unknown> {
  return { id: newRowId(), blockType: block.slug, ...defaultsFor(block.fields) };
}

/**
 * Deep-clone a row (array item or block) giving it, and every nested row, a new
 * id. Ids of related documents (uploads, relationships) are left alone, so a
 * duplicated card still points at the same image.
 */
export function cloneRow(row: unknown, rowFields: SchemaField[]): unknown {
  if (!row || typeof row !== "object") return row;
  const copy: Record<string, unknown> = { ...(row as Record<string, unknown>), id: newRowId() };
  for (const f of rowFields) copy[f.name] = cloneValue(copy[f.name], f);
  return copy;
}

function cloneValue(value: unknown, field: SchemaField): unknown {
  if (value == null) return value;
  if (field.type === "group") {
    const out: Record<string, unknown> = { ...(value as Record<string, unknown>) };
    for (const f of field.fields ?? []) out[f.name] = cloneValue(out[f.name], f);
    return out;
  }
  if (field.type === "array" && Array.isArray(value)) return value.map((r) => cloneRow(r, field.fields ?? []));
  if (field.type === "blocks" && Array.isArray(value)) {
    return value.map((r) => {
      const block = field.blocks?.find((b) => b.slug === (r as { blockType?: string })?.blockType);
      return block ? cloneRow(r, block.fields) : structuredClone(r);
    });
  }
  return typeof value === "object" ? structuredClone(value) : value;
}

const idOf = (v: unknown): unknown => (v && typeof v === "object" && "id" in (v as object) ? (v as { id: unknown }).id : v);

function normalizeRelation(value: unknown, field: SchemaField): unknown {
  if (value == null) return value;
  const one = (v: unknown) => {
    // Polymorphic: { relationTo, value }
    if (Array.isArray(field.relationTo) && v && typeof v === "object" && "relationTo" in (v as object)) {
      const p = v as { relationTo: string; value: unknown };
      return { relationTo: p.relationTo, value: idOf(p.value) };
    }
    return idOf(v);
  };
  return Array.isArray(value) ? value.map(one) : one(value);
}

/**
 * Turn rendered (populated) data back into what Payload expects on write:
 * uploads and relationships become ids, everything else passes through.
 */
export function normalizeValue(value: unknown, field: SchemaField): unknown {
  if (value == null) return value;
  switch (field.type) {
    case "upload":
    case "relationship":
      return normalizeRelation(value, field);
    case "richText":
      return normalizeRichText(value);
    case "group": {
      const out: Record<string, unknown> = { ...(value as Record<string, unknown>) };
      for (const f of field.fields ?? []) if (f.name in out) out[f.name] = normalizeValue(out[f.name], f);
      return out;
    }
    case "array":
      return Array.isArray(value) ? value.map((row) => normalizeRow(row, field.fields ?? [])) : value;
    case "blocks":
      return Array.isArray(value)
        ? value.map((row) => {
            const block = field.blocks?.find((b) => b.slug === (row as { blockType?: string })?.blockType);
            return block ? normalizeRow(row, block.fields) : row;
          })
        : value;
    default:
      return value;
  }
}

/**
 * Rich text read at depth > 0 has populated relations inside nodes (an upload
 * node's `value`, an internal link's `fields.doc.value`). Payload stores ids, so
 * those go back to ids; nothing else in the tree changes.
 */
export function normalizeRichText(value: unknown): unknown {
  const walk = (node: any): any => {
    if (!node || typeof node !== "object") return node;
    let out = node;
    if ((node.type === "upload" || node.type === "relationship") && node.value && typeof node.value === "object" && "id" in node.value) {
      out = { ...out, value: node.value.id };
    }
    const doc = node.fields?.doc;
    if ((node.type === "link" || node.type === "autolink") && doc?.value && typeof doc.value === "object" && "id" in doc.value) {
      out = { ...out, fields: { ...node.fields, doc: { ...doc, value: doc.value.id } } };
    }
    if (Array.isArray(node.children)) out = { ...out, children: node.children.map(walk) };
    return out;
  };
  const root = (value as { root?: unknown })?.root;
  return root ? { ...(value as object), root: walk(root) } : value;
}

function normalizeRow(row: unknown, rowFields: SchemaField[]): unknown {
  if (!row || typeof row !== "object") return row;
  const out: Record<string, unknown> = { ...(row as Record<string, unknown>) };
  for (const f of rowFields) if (f.name in out) out[f.name] = normalizeValue(out[f.name], f);
  return out;
}

/** Normalize the given top-level keys of a document for a PATCH body. */
export function buildPatch(doc: Record<string, unknown>, keys: string[], fields: SchemaField[]): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const key of keys) {
    const field = fields.find((f) => f.name === key);
    patch[key] = field ? normalizeValue(doc[key], field) : doc[key];
  }
  return patch;
}

/** Top-level keys (from `keys`) whose values differ between two documents. */
export function changedKeys(prev: Record<string, unknown>, next: Record<string, unknown>, keys: string[]): string[] {
  return keys.filter((k) => prev[k] !== next[k] && JSON.stringify(prev[k]) !== JSON.stringify(next[k]));
}
