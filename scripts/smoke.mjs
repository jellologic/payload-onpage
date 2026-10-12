// Import every published entry from dist under plain Node (how the Payload CLI loads the plugin).
// Usage: node scripts/smoke.mjs   (after `bun run build`)
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// Loaded only by the admin's bundler (imports @payloadcms/ui, which imports CSS).
const BUNDLER_ONLY = new Set(['@payload-onpage/plugin/admin'])

const failures = []
for (const pkg of ['core', 'plugin', 'react', 'lexical', 'next']) {
  const dir = join('packages', pkg)
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  // A pattern export (`./locales/*` → `./dist/locales/*.js`) stands for every file it matches.
  const entries = Object.entries(manifest.exports).flatMap(([sub, target]) => {
    if (!sub.includes('*')) return [[sub, target]]
    const [folder, ext] = target.default.split('*')
    const path = join(dir, folder)
    if (!existsSync(path)) return []
    return readdirSync(path)
      .filter((f) => f.endsWith(ext) && !f.endsWith(`.d${ext}`))
      .map((f) => {
        const stem = f.slice(0, -ext.length)
        return [sub.replace('*', stem), { default: target.default.replace('*', stem) }]
      })
  })
  for (const [sub, target] of entries) {
    const name = `${manifest.name}${sub === '.' ? '' : sub.slice(1)}`
    if (BUNDLER_ONLY.has(name)) {
      console.log(`skip ${name} (bundler-only)`)
      continue
    }
    try {
      const mod = await import(pathToFileURL(join(process.cwd(), dir, target.default)).href)
      if (!Object.keys(mod).length) throw new Error('no exports')
      console.log(`ok   ${name}`)
    } catch (e) {
      failures.push(name)
      console.error(`FAIL ${name}: ${e instanceof Error ? e.message : e}`)
    }
  }
}
if (failures.length) process.exit(1)
