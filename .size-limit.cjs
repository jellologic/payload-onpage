// Size budgets (minified + gzipped, peers excluded). `bun run size` checks them; CI fails when exceeded.
const ignore = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'next',
  '@tanstack/react-start',
  '@tanstack/react-router',
  '@tanstack/router-core',
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

// Panels in react/dist/ui/lazy load on first use (prefetched when idle), and the rich-text
// editor loads when a rich-text field is opened: the editor budgets measure the first
// download; the on-demand chunks have their own budgets.
const onDemandPanels = (config) => {
  config.plugins = [
    ...(config.plugins ?? []),
    {
      name: 'on-demand-panels',
      setup: (b) =>
        b.onResolve({ filter: /(\/lazy\/[^/]+|\/InlineRichText)\.js$/ }, (a) => ({
          path: a.path,
          external: true,
        })),
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
    limit: '31 KB',
    ignore,
    modifyEsbuildConfig: onDemandPanels,
  },
  {
    name: 'Visitor (Start): <OnPage /> client mount (every page)',
    path: 'packages/tanstack-start/dist/client.js',
    import: '{ OnPageMount }',
    limit: '1.5 KB',
    ignore,
    modifyEsbuildConfig: lazyEditor,
  },
  {
    name: 'Editor (Start, lazy, editors only)',
    path: 'packages/tanstack-start/dist/editor.js',
    import: '{ TanstackEditor }',
    limit: '31 KB',
    ignore,
    modifyEsbuildConfig: onDemandPanels,
  },
  {
    // Block picker, settings, publish…: loaded on first use. Measured on its own, so it
    // also counts modules the editor has already loaded (Dialog, core helpers).
    name: 'Editor panels (on demand)',
    path: 'packages/react/dist/ui/lazy/panels.js',
    import: '{ OnDemandPanel }',
    limit: '12 KB',
    ignore,
  },
  {
    name: 'Guest comment form (share-link viewers, on demand)',
    path: 'packages/react/dist/ui/lazy/GuestComment.js',
    import: '{ GuestComment }',
    limit: '4 KB',
    ignore,
  },
  {
    // Measured on its own (with what it shares with the editor); Lexical itself is excluded.
    name: 'Rich-text editor (on demand)',
    path: 'packages/lexical/dist/InlineRichText.js',
    import: '{ InlineRichText }',
    limit: '8 KB',
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
    // Server only (never shipped to browsers); a guard against accidental bloat.
    limit: '14 KB',
    ignore,
  },
]
