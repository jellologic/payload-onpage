// Concatenate the docs into llms-full.txt (one file for LLM context). `--check` fails if it's stale.
import { readFileSync, writeFileSync } from 'node:fs'

const files = [
  'README.md',
  'docs/getting-started.md',
  'docs/getting-started-tanstack.md',
  'docs/concepts/architecture.md',
  'docs/concepts/auto-mapping.md',
  'docs/concepts/modes.md',
  'docs/concepts/security.md',
  'docs/guides/annotations.md',
  'docs/guides/client-mode.md',
  'docs/guides/globals-and-multiple-documents.md',
  'docs/guides/custom-field-editor.md',
  'docs/guides/custom-data-source.md',
  'docs/guides/custom-media-library.md',
  'docs/guides/localization.md',
  'docs/guides/caching-and-ppr.md',
  'docs/troubleshooting.md',
  'docs/compatibility.md',
  'docs/upgrading.md',
]
const out = [
  '# payload-onpage — full documentation',
  '',
  'Generated from the repository docs by scripts/llms-full.mjs. Source: https://github.com/jellologic/payload-onpage',
  '',
  ...files.flatMap((f) => [`\n<!-- ${f} -->\n`, readFileSync(f, 'utf8').trim(), '']),
].join('\n')

if (process.argv.includes('--check')) {
  if (readFileSync('llms-full.txt', 'utf8') !== out) {
    console.error('llms-full.txt is out of date: run `bun run docs:llms`')
    process.exit(1)
  }
} else writeFileSync('llms-full.txt', out)
