import { createHash, createHmac } from 'node:crypto'
import { NextRequest } from 'next/server.js'
import { describe, expect, it } from 'vitest'
import { isPayloadUser } from '../proxy.ts'

const SECRET = 'payload-secret'
/** The key Payload derives from its secret, as `new BasePayload().init()` does. */
const payloadKey = (secret: string) =>
  createHash('sha256').update(secret).digest('hex').slice(0, 32)

/**
 * A token as Payload signs it at login (payload/src/auth/jwt.ts: jose SignJWT,
 * HS256, header `{ alg, authVersion, typ }`, claims plus iat/exp).
 */
const login = async (
  fields: Record<string, unknown> = { collection: 'users', id: 1, email: 'a@b.c' },
  { secret = SECRET, tokenExpiration = 7200 } = {},
) => {
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url')
  const iat = Math.floor(Date.now() / 1000)
  const head = `${b64({ alg: 'HS256', authVersion: 1, typ: 'JWT' })}.${b64({ ...fields, iat, exp: iat + tokenExpiration })}`
  return `${head}.${createHmac('sha256', payloadKey(secret)).update(head).digest('base64url')}`
}

const req = (cookie: string) =>
  new NextRequest('http://site.test/x', { headers: cookie ? { cookie } : {} })

describe('isPayloadUser', () => {
  it('admits a token Payload signed for the admin user collection', async () => {
    const token = await login()
    expect(await isPayloadUser(req(`payload-token=${token}`), { secret: SECRET })).toBe(true)
    // Another prefix, another collection.
    expect(
      await isPayloadUser(req(`site-token=${token}`), { secret: SECRET, cookiePrefix: 'site' }),
    ).toBe(true)
  })
  it('refuses forged, foreign, expired, other-collection and missing tokens', async () => {
    const valid = await login()
    const [h, b] = valid.split('.')
    const cases = [
      '',
      'payload-token=garbage',
      `payload-token=${await login(undefined, { secret: 'other' })}`, // another site's secret
      `payload-token=${await login(undefined, { tokenExpiration: -10 })}`, // expired
      `payload-token=${await login({ collection: 'customers', id: 1 })}`, // a site customer
      `payload-token=${h}.${Buffer.from(JSON.stringify({ collection: 'users', exp: 9e9 })).toString('base64url')}.${valid.split('.')[2]}`, // edited claims
      `payload-token=${Buffer.from('{"alg":"none"}').toString('base64url')}.${b}.`, // alg none
    ]
    for (const cookie of cases)
      expect(await isPayloadUser(req(cookie), { secret: SECRET })).toBe(false)
    expect(await isPayloadUser(req(`payload-token=${valid}`), { secret: undefined })).toBe(false)
    expect(await isPayloadUser(req(`payload-token=${valid}`), { secret: [] })).toBe(false)
  })
  it('accepts tokens signed with a previous secret while rotating', async () => {
    const old = await login(undefined, { secret: 'old' })
    expect(await isPayloadUser(req(`payload-token=${old}`), { secret: ['new', 'old'] })).toBe(true)
    expect(await isPayloadUser(req(`payload-token=${old}`), { secret: ['new'] })).toBe(false)
  })
})
