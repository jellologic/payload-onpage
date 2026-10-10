/**
 * A reference to one editable Payload document: a collection document or a
 * global. Every target on the page carries one, so a single session can edit
 * the page, its header global and any embedded document at once.
 */
export type DocRef =
  | { kind: "collection"; slug: string; id: string | number }
  | { kind: "global"; slug: string };

/** Stable string key: "c:<slug>:<id>" or "g:<slug>". */
export function refKey(ref: DocRef): string {
  return ref.kind === "global" ? `g:${ref.slug}` : `c:${ref.slug}:${ref.id}`;
}

export function parseRefKey(key: string): DocRef | null {
  if (key.startsWith("g:")) {
    const slug = key.slice(2);
    return slug ? { kind: "global", slug } : null;
  }
  if (key.startsWith("c:")) {
    const rest = key.slice(2);
    const i = rest.indexOf(":");
    if (i <= 0 || i === rest.length - 1) return null;
    const slug = rest.slice(0, i);
    const raw = rest.slice(i + 1);
    return { kind: "collection", slug, id: /^\d+$/.test(raw) ? Number(raw) : raw };
  }
  return null;
}

export const sameRef = (a: DocRef, b: DocRef) => refKey(a) === refKey(b);

/** A ref for a loaded collection document, or null when it has no id yet. */
export function collectionRef(slug: string, doc: { id?: string | number } | null | undefined): DocRef | null {
  return doc?.id === undefined || doc?.id === null ? null : { kind: "collection", slug, id: doc.id };
}

export const globalRef = (slug: string): DocRef => ({ kind: "global", slug });
