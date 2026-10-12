// Publish every @payload-onpage/* package whose version isn't on npm yet.
// `bun pm pack` rewrites workspace:* to real versions; npm publishes the tarball with provenance.
// Run by .github/workflows/release.yml once the Version packages PR is merged.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8', ...opts })
const order = ['core', 'react', 'lexical', 'plugin', 'next', 'tanstack-start'] // dependencies first

// All packages are versioned together; refuse to publish a mixed set.
const versions = new Set(
  order.map((p) => JSON.parse(readFileSync(join('packages', p, 'package.json'), 'utf8')).version),
)
if (versions.size !== 1)
  throw new Error(`packages must share one version, found ${[...versions].join(', ')}`)

const pending = order.filter((p) => {
  const { name, version } = JSON.parse(readFileSync(join('packages', p, 'package.json'), 'utf8'))
  try {
    run('npm', ['view', `${name}@${version}`, 'version'])
    console.log(`${name}@${version} is already published`)
    return false
  } catch {
    return true
  }
})

// Pack and dry-run everything first, so a bad tarball can't leave a half-published set.
const tarballs = pending.map((p) => {
  const dest = mkdtempSync(join(tmpdir(), `onpage-${p}-`))
  run('bun', ['pm', 'pack', '--destination', dest], { cwd: join('packages', p) })
  const file = join(
    dest,
    readdirSync(dest).find((f) => f.endsWith('.tgz')),
  )
  // bun takes workspace:* versions from bun.lock; a stale lockfile publishes stale ranges.
  const packed = JSON.parse(run('tar', ['-xOf', file, 'package/package.json']))
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [dep, range] of Object.entries(packed[field] ?? {})) {
      if (dep.startsWith('@payload-onpage/') && range !== packed.version)
        throw new Error(
          `${packed.name}@${packed.version} would depend on ${dep}@${range}; run \`bun install\` and commit bun.lock`,
        )
    }
  }
  run('npm', ['publish', file, '--access', 'public', '--provenance', '--dry-run'])
  return { p, file }
})
for (const { p, file } of tarballs) {
  const { name, version } = JSON.parse(readFileSync(join('packages', p, 'package.json'), 'utf8'))
  run('npm', ['publish', file, '--access', 'public', '--provenance'])
  console.log(`Published ${name}@${version}`)
}
