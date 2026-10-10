/**
 * Immutable path helpers over plain document data. Paths use Payload's dotted
 * form: "sections.3.items.0.title".
 */

export type PathSegment = string | number

export function parsePath(path: string | PathSegment[]): PathSegment[] {
  if (Array.isArray(path)) return path
  return path
    .split('.')
    .filter((s) => s !== '')
    .map((s) => (/^\d+$/.test(s) ? Number(s) : s))
}

export function joinPath(...parts: Array<string | number | undefined | null>): string {
  return parts.filter((p) => p !== undefined && p !== null && p !== '').join('.')
}

export function getAt<T = unknown>(obj: unknown, path: string | PathSegment[]): T | undefined {
  let cur: any = obj
  for (const seg of parsePath(path)) {
    if (cur == null) return undefined
    cur = cur[seg as any]
  }
  return cur as T | undefined
}

/** Returns a copy of `obj` with `value` at `path`; untouched branches are shared. */
export function setAt<T>(obj: T, path: string | PathSegment[], value: unknown): T {
  const segs = parsePath(path)
  if (!segs.length) return value as T
  const [head, ...rest] = segs
  const base: any = obj ?? (typeof head === 'number' ? [] : {})
  const copy: any = Array.isArray(base) ? base.slice() : { ...base }
  copy[head as any] = rest.length ? setAt(base[head as any], rest, value) : value
  return copy as T
}

/** Apply `fn` to the array at `path` (an absent array is treated as []). */
export function updateArray<T>(
  obj: T,
  path: string | PathSegment[],
  fn: (arr: unknown[]) => unknown[],
): T {
  const current = getAt<unknown[]>(obj, path)
  return setAt(obj, path, fn(Array.isArray(current) ? current : []))
}

export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= arr.length) return arr
  const target = Math.max(0, Math.min(arr.length - 1, to))
  const copy = arr.slice()
  const [item] = copy.splice(from, 1)
  copy.splice(target, 0, item)
  return copy
}

export function insertItem<T>(arr: T[], index: number, item: T): T[] {
  const copy = arr.slice()
  copy.splice(Math.max(0, Math.min(arr.length, index)), 0, item)
  return copy
}

export function removeItem<T>(arr: T[], index: number): T[] {
  if (index < 0 || index >= arr.length) return arr
  const copy = arr.slice()
  copy.splice(index, 1)
  return copy
}

/** Split "sections.3.items.1" into the array path and the index: ["sections.3.items", 1]. */
export function splitItemPath(path: string): [string, number] | null {
  const segs = parsePath(path)
  const last = segs[segs.length - 1]
  if (typeof last !== 'number') return null
  return [segs.slice(0, -1).join('.'), last]
}

/** A 24-hex id, the shape Payload uses for array and block rows. */
export function newRowId(): string {
  const bytes = new Uint8Array(12)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Only same-site, absolute paths: "/x", not "//evil.com", "https://…" or "/\\evil.com". */
export function isSafePath(path: unknown): path is string {
  return (
    typeof path === 'string' &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.includes('\\')
  )
}
