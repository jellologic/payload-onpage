import { withPayload } from '@payloadcms/tanstack-start'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import rsc from '@vitejs/plugin-rsc'
import { nitro } from 'nitro/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Monorepo only: the workspace root holds Payload v3 + lexical 0.50 (for the
// Next.js example and tests), so bare `payload` / `lexical` imports inside the
// linked @payload-onpage/* packages would bind those instead of this
// example's v4 / 0.52. Re-resolve them from this example, with normal export
// conditions. Installed from npm there is only one copy; no plugin needed.
const PINNED = ['payload', 'lexical', '@lexical/']
const isPinned = (source: string) =>
  PINNED.some(
    (name) => source === name || source.startsWith(name.endsWith('/') ? name : `${name}/`),
  )
const workspaceVersionPin = (): Plugin => ({
  name: 'onpage-workspace-version-pin',
  enforce: 'pre',
  async resolveId(source, importer) {
    // Prefix match: the editor imports `@lexical/react/*` subpaths, and an
    // exact match would leave those on the root's 0.50 next to a pinned 0.52.
    if (!isPinned(source)) return null
    const packagesDir = path.resolve(__dirname, '..', '..', 'packages') + path.sep
    if (!importer || !importer.startsWith(packagesDir)) return null
    return await this.resolve(source, path.join(__dirname, 'package.json'), { skipSelf: true })
  },
})

export default defineConfig(
  withPayload(
    ({ pluginOptions }) => ({
      plugins: [
        workspaceVersionPin(),
        rsc(pluginOptions.rsc),
        tanstackStart(pluginOptions.tanstackStart),
        viteReact(pluginOptions.react),
        nitro(pluginOptions.nitro),
      ],
      resolve: {
        alias: [
          {
            find: /^@\//,
            replacement: path.resolve(__dirname, 'src') + '/',
          },
        ],
      },
      server: { port: 3102 },
      // Monorepo only: esbuild pre-bundling resolves bare imports without the
      // resolveId plugin above, which would bake the root's lexical 0.50 into
      // optimized chunks next to this example's runtime 0.52 (two LexicalNode
      // identities crash the editor). Serve these unbundled instead.
      optimizeDeps: {
        exclude: [
          'lexical',
          '@lexical/list',
          '@lexical/react',
          '@lexical/rich-text',
          '@lexical/selection',
          '@lexical/utils',
          '@payload-onpage/lexical',
        ],
      },
    }),
    { payloadConfigPath: path.resolve(__dirname, 'src', 'payload.config.ts') },
  ),
)
