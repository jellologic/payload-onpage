/**
 * A reference to one editable Payload document: a collection document or a
 * global. Every target on the page carries one, so a single session can edit
 * the page, its header global and any embedded document at once.
 */
export type DocRef =
  { kind: 'collection'; slug: string; id: string | number } | { kind: 'global'; slug: string }

/** Stable string key: "c:<slug>:<id>" or "g:<slug>". */
export function refKey(ref: DocRef): string {
  return ref.kind === 'global' ? `g:${ref.slug}` : `c:${ref.slug}:${ref.id}`
}

export function parseRefKey(key: string): DocRef | null {
  if (key.startsWith('g:')) {
    const slug = key.slice(2)
    return slug ? { kind: 'global', slug } : null
  }
  if (key.startsWith('c:')) {
    const rest = key.slice(2)
    const i = rest.indexOf(':')
    if (i <= 0 || i === rest.length - 1) return null
    return collectionRef(rest.slice(0, i), rest.slice(i + 1))
  }
  return null
}

/**
 * A collection ref from an id read as text (a key, a URL, an attribute). Only a
 * canonical safe integer becomes a number: "007" and ids past 2^53 stay text,
 * so the document they name is the one that's opened. Servers that know the
 * collection's id type should decide instead (the plugin does).
 */
export function collectionRef(slug: string, id: string): DocRef {
  const n = Number(id)
  return { kind: 'collection', slug, id: Number.isSafeInteger(n) && String(n) === id ? n : id }
}

/** Key for one field (or row/list) of one document: "<refKey>|<path>". */
export const targetKey = (ref: DocRef | string, path: string): string =>
  `${typeof ref === 'string' ? ref : refKey(ref)}|${path}`
