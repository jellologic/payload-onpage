/**
 * The editor's `onpage` mode cookie: `<mode>`, or `<mode>:<authCookie>:<hash>`
 * when bound to a session. Shared by the session helpers (server components)
 * and the proxy, so both read a binding the same way.
 */
import { isOnPageMode, sha256, type OnPageMode } from '@payload-onpage/core'

const HASH_LENGTH = 32
export const fingerprint = async (token: string) => (await sha256(token)).slice(0, HASH_LENGTH)

export interface ModeCookie {
  mode: OnPageMode
  /** True when bound to an auth cookie that is present and matches. */
  bound: boolean
}

/** Parse the mode cookie; null when unknown or bound to a session that ended. */
export async function readModeCookie(
  raw: string | undefined,
  cookie: (name: string) => string | undefined,
): Promise<ModeCookie | null> {
  if (!raw) return null
  const [mode, bound, hash] = raw.split(':')
  if (!isOnPageMode(mode)) return null
  if (!bound) return { mode, bound: false }
  const token = cookie(bound)
  if (!token || (await fingerprint(token)) !== hash) return null
  return { mode, bound: true }
}
