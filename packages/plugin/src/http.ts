/** Request helpers shared by the endpoints. */
import { parseRefKey, safePath, type DocRef } from '@payload-onpage/core'
import type { PayloadRequest } from 'payload'

/** The site origin: `serverURL` when configured, else the request's own origin. */
export function originOf(req: PayloadRequest): string {
  const configured = req.payload.config.serverURL
  if (configured) return configured.replace(/\/$/, '')
  try {
    return new URL(req.url ?? '').origin
  } catch {
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost'
    const proto = req.headers.get('x-forwarded-proto') ?? 'http'
    return `${proto}://${host}`
  }
}

export const isSecure = (req: PayloadRequest): boolean => originOf(req).startsWith('https:')

export const queryOf = (req: PayloadRequest): URLSearchParams =>
  new URL(req.url ?? '/', 'http://localhost').searchParams

export const text = (body: string, status: number): Response =>
  new Response(body, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })

export const json = (body: unknown, status = 200): Response =>
  Response.json(body, { status, headers: { 'cache-control': 'private, no-store' } })

/** Redirect to a same-origin path (anything unsafe becomes "/"). 303 turns a POST into a GET. */
export const redirectTo = (req: PayloadRequest, path: unknown, status: 303 | 307 = 303): Response =>
  Response.redirect(new URL(safePath(path) ?? '/', originOf(req)), status)

/**
 * CSRF guard for state-changing endpoints: a POST from this site (Origin, or
 * Sec-Fetch-Site when Origin is absent). Returns an error response or null.
 */
export function rejectCrossSite(req: PayloadRequest): Response | null {
  if (req.method?.toUpperCase() !== 'POST') return text('Method not allowed', 405)
  const origin = req.headers.get('origin')
  if (origin) return origin === originOf(req) ? null : text('Cross-site request refused', 403)
  const site = req.headers.get('sec-fetch-site')
  return site === 'same-origin' || site === 'none' ? null : text('Cross-site request refused', 403)
}

/** A document ref from `kind`, `slug`, `id` query/body values. */
export function readRef(values: { kind?: unknown; slug?: unknown; id?: unknown }): DocRef | null {
  const slug = typeof values.slug === 'string' ? values.slug : ''
  if (!slug) return null
  if (values.kind === 'global') return { kind: 'global', slug }
  const id = values.id
  if (typeof id === 'number') return { kind: 'collection', slug, id }
  if (typeof id !== 'string' || !id) return null
  return parseRefKey(`c:${slug}:${id}`)
}
