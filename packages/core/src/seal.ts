/**
 * Authenticated encryption for small payloads (AES-256-GCM, key derived with
 * HKDF-SHA256 from a secret and a purpose). Uses WebCrypto only, so the same
 * code runs in Node, the browser and edge runtimes (Next.js proxy).
 *
 * Used for preview-link tokens and the preview cookie: tamper-proof, opaque
 * to the holder, and bound to one purpose (a token can't be replayed as a cookie).
 */
const enc = new TextEncoder()
const dec = new TextDecoder()
const keys = new Map<string, Promise<CryptoKey>>()

export const SEAL_PURPOSE = {
  previewLink: 'payload-onpage:preview-link:v1',
  previewCookie: 'payload-onpage:preview-cookie:v1',
} as const

function key(secret: string, purpose: string): Promise<CryptoKey> {
  const id = `${purpose}\u0000${secret}`
  let k = keys.get(id)
  if (!k) {
    k = (async () => {
      const ikm = await crypto.subtle.importKey('raw', enc.encode(secret), 'HKDF', false, [
        'deriveKey',
      ])
      return crypto.subtle.deriveKey(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: enc.encode('payload-onpage'),
          info: enc.encode(purpose),
        },
        ikm,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      )
    })()
    keys.set(id, k)
  }
  return k
}

const toB64url = (bytes: Uint8Array): string => {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const fromB64url = (s: string): Uint8Array | null => {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
    return Uint8Array.from(bin, (c) => c.charCodeAt(0))
  } catch {
    return null
  }
}

/** Encrypt and authenticate `data` (JSON) for `purpose`. */
export async function seal(data: unknown, secret: string, purpose: string): Promise<string> {
  if (!secret) throw new Error('payload-onpage: a secret is required to seal data')
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      await key(secret, purpose),
      enc.encode(JSON.stringify(data)),
    ),
  )
  const out = new Uint8Array(iv.length + ct.length)
  out.set(iv)
  out.set(ct, iv.length)
  return toB64url(out)
}

/** Decrypt a sealed value; null if it was tampered with, sealed for another purpose or secret, or malformed. */
export async function unseal<T>(
  token: string | null | undefined,
  secret: string,
  purpose: string,
): Promise<T | null> {
  if (!token || !secret || token.length > 8192) return null
  const bytes = fromB64url(token)
  if (!bytes || bytes.length < 13 + 16) return null
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.slice(0, 12) },
      await key(secret, purpose),
      bytes.slice(12),
    )
    return JSON.parse(dec.decode(pt)) as T
  } catch {
    return null
  }
}

/** SHA-256 hex digest (WebCrypto). */
export async function sha256(input: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(input)))
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * The sealed `onpage_preview` cookie a share link sets: which page it opens
 * and until when. Written by the plugin, read by the framework adapter.
 */
export interface PreviewGrant {
  /** The page's pathname. */
  path: string
  /** The document's ref key. */
  ref: string
  /** Expiry, seconds since the epoch. */
  exp: number
  /** The draft credential for that page (adapter-specific: Next's draft-mode secret on Next.js, a constant marker where reads verify the grant directly). */
  draft: string
}

/** A well-formed grant that hasn't expired. Anything else, including a missing `exp`, is refused. */
export function isLivePreviewGrant(value: unknown, now = Date.now()): value is PreviewGrant {
  if (!value || typeof value !== 'object') return false
  const g = value as Partial<Record<keyof PreviewGrant, unknown>>
  return (
    typeof g.path === 'string' &&
    typeof g.ref === 'string' &&
    typeof g.draft === 'string' &&
    !!g.draft &&
    typeof g.exp === 'number' &&
    Number.isFinite(g.exp) &&
    g.exp * 1000 > now
  )
}
