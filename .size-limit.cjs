// Size budgets (minified + gzipped, peers excluded). `bun run size` checks them; CI fails when exceeded.
const ignore = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'next',
  'payload',
  '@payloadcms/ui',
  '@payloadcms/translations',
  'lexical',
  '@lexical/react',
  '@lexical/list',
  '@lexical/rich-text',
  '@lexical/selection',
  '@lexical/utils',
  'node:crypto',
]
// Treat the editor's dynamic import as a separate chunk (Next.js splits there), so the visitor budget
// measures only what every page loads.
const lazyEditor = (config) => {
  config.plugins = [
    ...(config.plugins ?? []),
    {
      name: 'lazy-editor',
      setup: (b) =>
        b.onResolve({ filter: /\.\/editor\.js$/ }, (a) => ({ path: a.path, external: true })),
    },
  ]
  return config
}

module.exports = [
  {
    name: 'Visitor: <OnPage /> client mount (every page)',
    path: 'packages/next/dist/client.js',
    import: '{ OnPageMount }',
    limit: '1.5 KB',
    ignore,
    modifyEsbuildConfig: lazyEditor,
  },
  {
    name: 'Annotations (server-safe)',
    path: 'packages/react/dist/annotations.js',
    import: '{ editable }',
    limit: '1 KB',
    ignore,
  },
  {
    name: 'Client mode: <OnPageClient>',
    path: 'packages/react/dist/OnPageClient.js',
    import: '{ OnPageClient }',
    limit: '4 KB',
    ignore,
  },
  {
    name: 'Editor (lazy, editors only)',
    path: 'packages/next/dist/editor.js',
    import: '{ NextEditor }',
    limit: '30 KB',
    ignore,
  },
  {
    name: 'Proxy (edge)',
    path: 'packages/next/dist/proxy.js',
    import: '{ createOnPageProxy }',
    limit: '2 KB',
    ignore,
  },
  {
    name: 'Plugin (server)',
    path: 'packages/plugin/dist/index.js',
    import: '{ onpage }',
    limit: '8 KB',
    ignore,
  },
]
