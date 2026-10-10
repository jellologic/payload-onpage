import { describe, expect, it } from 'vitest'
import { pathnameOf, safeLinkUrl, safePath, samePath } from '../path.ts'
import { SEAL_PURPOSE, seal, sha256, unseal } from '../seal.ts'

describe('safePath (open-redirect guard)', () => {
  it.each([
    ['/about', '/about'],
    ['/a/b?x=1#top', '/a/b?x=1#top'],
    ['/', '/'],
    ['/caf%C3%A9', '/caf%C3%A9'],
  ])('accepts %s', (input, out) => expect(safePath(input)).toBe(out))

  it.each([
    '//evil.com',
    '/\\evil.com',
    '/\t/evil.com',
    '/%09/evil.com',
    '/\n/evil.com',
    '/%0a/evil.com',
    '/\r/evil.com',
    '/%5cevil.com',
    '/%5Cevil.com',
    'https://evil.com',
    'javascript:alert(1)',
    'evil.com',
    '',
    null,
    42,
    `/${'a'.repeat(3000)}`,
  ])('rejects %j', (input) => expect(safePath(input)).toBeNull())

  it('compares pages ignoring query, hash and a trailing slash', () => {
    expect(pathnameOf('/a?x#y')).toBe('/a')
    expect(samePath('/a/', '/a?x=1')).toBe(true)
    expect(samePath('/', '/')).toBe(true)
    expect(samePath('/a', '/ab')).toBe(false)
    expect(samePath('/a///', '/a')).toBe(true)
    const hostile = `/${'/'.repeat(100_000)}x`
    const t0 = performance.now()
    samePath(hostile, '/x')
    expect(performance.now() - t0).toBeLessThan(50)
  })
})

describe('seal / unseal', () => {
  const secret = 'test-secret'
  it('round-trips data', async () => {
    const t = await seal({ a: 1, path: '/x' }, secret, SEAL_PURPOSE.previewLink)
    expect(await unseal(t, secret, SEAL_PURPOSE.previewLink)).toEqual({ a: 1, path: '/x' })
  })
  it('is randomized (same input, different output)', async () => {
    const a = await seal({ a: 1 }, secret, SEAL_PURPOSE.previewLink)
    const b = await seal({ a: 1 }, secret, SEAL_PURPOSE.previewLink)
    expect(a).not.toBe(b)
  })
  it('rejects another secret, another purpose, tampering and junk', async () => {
    const t = await seal({ a: 1 }, secret, SEAL_PURPOSE.previewLink)
    expect(await unseal(t, 'other', SEAL_PURPOSE.previewLink)).toBeNull()
    expect(await unseal(t, secret, SEAL_PURPOSE.previewCookie)).toBeNull()
    const mid = Math.floor(t.length / 2)
    const tampered = t.slice(0, mid) + (t[mid] === 'A' ? 'B' : 'A') + t.slice(mid + 1)
    expect(await unseal(tampered, secret, SEAL_PURPOSE.previewLink)).toBeNull()
    for (const junk of ['', 'abc', '!!!', null, undefined, 'x'.repeat(9000)]) {
      expect(await unseal(junk as string, secret, SEAL_PURPOSE.previewLink)).toBeNull()
    }
  })
  it('refuses to seal without a secret', async () => {
    await expect(seal({}, '', SEAL_PURPOSE.previewLink)).rejects.toThrow(/secret/)
  })
  it('hashes with SHA-256', async () => {
    expect(await sha256('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})

describe('safeLinkUrl', () => {
  it.each([
    'https://x.test/a',
    'http://x.test',
    'mailto:a@b.c',
    'tel:+1555',
    '/page',
    '#top',
    '?q=1',
    './rel',
    '../up',
  ])('accepts %s', (u) => expect(safeLinkUrl(u)).toBe(u))
  it.each([
    'javascript:alert(1)',
    ' JavaScript:alert(1)',
    'data:text/html,x',
    'vbscript:x',
    '//evil.test',
    'java\tscript:x',
    'file:///etc/passwd',
    '',
  ])('rejects %j', (u) => expect(safeLinkUrl(u)).toBeNull())
})
