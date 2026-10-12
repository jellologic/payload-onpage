/**
 * Edge check for "a signed-in Payload user", for the proxy's `allowDraft`. Your
 * own preview routes (the website template's `/next/preview`, Payload's Live
 * Preview) turn on Next's draft mode without payload-onpage's mode cookie;
 * this admits their users without trusting a cookie's mere presence.
 */
import { sha256 } from '@payload-onpage/core'
import type { NextRequest } from 'next/server.js'

export interface PayloadUserOptions {
  /**
   * Payload's `secret` (PAYLOAD_SECRET): the one Payload signs its auth tokens
   * with. While rotating it, `[secret, ...previousSecrets]`.
   */
  secret: string | readonly string[] | undefined
  /** The auth collection to admit. Default "users" (Payload's `admin.user`). */
  collection?: string | undefined
  /** Payload's `cookiePrefix`. Default "payload" (cookie `payload-token`). */
  cookiePrefix?: string | undefined
}

const enc = new TextEncoder()

const fromB64url = (s: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

const json = (s: string): Record<string, unknown> | null => {
  const v: unknown = JSON.parse(new TextDecoder().decode(fromB64url(s)))
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
}

/**
 * Does the request carry a valid Payload auth token for `collection`? Verifies
 * the token's signature (HS256, keyed the way Payload derives it from its
 * secret), expiry and collection.
 *
 * It can't see sessions ended on the server (signing out elsewhere) until the
 * token expires (Payload's `tokenExpiration`, 2 hours by default).
 *
 *   createOnPageProxy({
 *     secret: process.env.PAYLOAD_SECRET,
 *     allowDraft: (request) => isPayloadUser(request, { secret: process.env.PAYLOAD_SECRET }),
 *   })
 */
export async function isPayloadUser(
  request: NextRequest,
  opts: PayloadUserOptions,
): Promise<boolean> {
  const token = request.cookies.get(`${opts.cookiePrefix ?? 'payload'}-token`)?.value
  const secrets = (typeof opts.secret === 'string' ? [opts.secret] : (opts.secret ?? [])).filter(
    Boolean,
  )
  if (!token || !secrets.length) return false
  try {
    const [header, body, signature, ...rest] = token.split('.')
    if (!header || !body || !signature || rest.length) return false
    if (json(header)?.alg !== 'HS256') return false
    let valid = false
    for (const secret of secrets) {
      // Payload signs with the first 32 hex characters of sha256(secret).
      const key = await crypto.subtle.importKey(
        'raw',
        enc.encode((await sha256(secret)).slice(0, 32)),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify'],
      )
      valid = await crypto.subtle.verify(
        'HMAC',
        key,
        fromB64url(signature),
        enc.encode(`${header}.${body}`),
      )
      if (valid) break
    }
    if (!valid) return false
    const claims = json(body)
    return (
      typeof claims?.exp === 'number' &&
      claims.exp * 1000 > Date.now() &&
      claims.collection === (opts.collection ?? 'users')
    )
  } catch {
    return false // malformed: not a user
  }
}
