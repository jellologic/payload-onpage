/**
 * Invisible source markers ("stega") for auto-mapping.
 *
 * In edit mode, string values read from Payload get an invisible suffix that
 * says where they came from: document ref, field path and editing kind. The
 * on-page editor finds rendered text carrying a marker and knows which field
 * to edit, so existing components work without annotations.
 *
 * Encoding (our own scheme):
 *   START  U+2063 U+2062                      invisible separator + times
 *   BODY   UTF-8 bytes of "<refKey>|<path>|<kindCode>", each byte as 4 base-4
 *          digits drawn from ZERO WIDTH SPACE / NON-JOINER / JOINER / WORD JOINER
 *   END    U+2064                             invisible plus
 * All of these render with zero width and are ignored by `trim()`-insensitive
 * layout; they are stripped before anything is written back to Payload.
 */

export type MarkerKind = 'text' | 'textarea' | 'richtext' | 'media'

export interface Marker {
  ref: string // refKey
  path: string
  kind: MarkerKind
}

const DIGITS = ['\u200b', '\u200c', '\u200d', '\u2060'] as const
const START = '\u2063\u2062'
const END = '\u2064'
const KIND_CODE: Record<MarkerKind, string> = {
  text: 't',
  textarea: 'a',
  richtext: 'r',
  media: 'm',
}
const CODE_KIND: Record<string, MarkerKind> = {
  t: 'text',
  a: 'textarea',
  r: 'richtext',
  m: 'media',
}

const DIGIT_VALUE = new Map<string, number>(DIGITS.map((c, i) => [c, i]))
// The codec's characters are single invisible code points (not combining sequences).
// eslint-disable-next-line no-misleading-character-class
const MARKER_RE = /\u2063\u2062([\u200b\u200c\u200d\u2060]*)\u2064/g
// eslint-disable-next-line no-misleading-character-class
const ANY_CODEC_RE = /[\u200b\u200c\u200d\u2060\u2062\u2063\u2064]/g

const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })

export function encodeMarker(marker: Marker): string {
  const bytes = encoder.encode(`${marker.ref}|${marker.path}|${KIND_CODE[marker.kind]}`)
  let body = ''
  for (const b of bytes)
    body += DIGITS[(b >> 6) & 3] + DIGITS[(b >> 4) & 3] + DIGITS[(b >> 2) & 3] + DIGITS[b & 3]
  return START + body + END
}

function decodeBody(body: string): Marker | null {
  if (body.length === 0 || body.length % 4 !== 0) return null
  const bytes = new Uint8Array(body.length / 4)
  for (let i = 0; i < bytes.length; i++) {
    let b = 0
    for (let j = 0; j < 4; j++) {
      const v = DIGIT_VALUE.get(body[i * 4 + j])
      if (v === undefined) return null
      b = (b << 2) | v
    }
    bytes[i] = b
  }
  let text: string
  try {
    text = decoder.decode(bytes)
  } catch {
    return null
  }
  const [ref, path, code, ...extra] = text.split('|')
  const kind = CODE_KIND[code]
  if (!ref || !path || !kind || extra.length) return null
  return { ref, path, kind }
}

/** Append a marker to a string (an already-marked string is re-marked, not doubled). */
export function stegaEncode(value: string, marker: Marker): string {
  return stegaClean(value) + encodeMarker(marker)
}

/** All complete markers in a string, in order. Damaged ones are skipped. */
export function stegaDecode(value: string): Marker[] {
  const out: Marker[] = []
  if (!value) return out
  for (const m of value.matchAll(MARKER_RE)) {
    const marker = decodeBody(m[1])
    if (marker) out.push(marker)
  }
  return out
}

/** The value with every codec character removed (also cleans partial markers). */
export function stegaClean(value: string): string {
  return value ? value.replace(ANY_CODEC_RE, '') : value
}

/**
 * Remove markers from every string in a value, deeply. Used before writes, so
 * a marker can never be persisted even if marked data is sent back.
 */
export function stegaCleanDeep<T>(value: T): T {
  if (typeof value === 'string') return stegaClean(value) as unknown as T
  if (Array.isArray(value))
    return (value as unknown[]).map((v) => stegaCleanDeep(v)) as unknown as T
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>))
      out[k] = stegaCleanDeep(v)
    return out as T
  }
  return value
}
