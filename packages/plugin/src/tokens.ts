/**
 * Signed, expiring preview tokens (HMAC-SHA256 over a JSON payload), so a
 * draft can be shared read-only with people who can't sign in.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export interface PreviewTokenPayload {
  /** refKey of the shared document */
  ref: string;
  /** site path the link opens */
  path: string;
  locale?: string;
  /** expiry, seconds since epoch */
  exp: number;
}

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

function sign(data: string, secret: string): string {
  return createHmac("sha256", `payload-onpage:${secret}`).update(data).digest("base64url");
}

export function createPreviewToken(payload: Omit<PreviewTokenPayload, "exp">, secret: string, ttlSeconds: number, now = Date.now()): string {
  const body = b64url(JSON.stringify({ ...payload, exp: Math.floor(now / 1000) + ttlSeconds }));
  return `${body}.${sign(body, secret)}`;
}

export function verifyPreviewToken(token: string, secret: string, now = Date.now()): PreviewTokenPayload | null {
  const [body, mac, extra] = String(token ?? "").split(".");
  if (!body || !mac || extra !== undefined) return null;
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  let payload: PreviewTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof payload?.exp !== "number" || payload.exp * 1000 < now) return null;
  if (typeof payload.path !== "string" || typeof payload.ref !== "string") return null;
  return payload;
}
