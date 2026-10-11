import type { GlobalConfig } from 'payload'

export const Header: GlobalConfig = {
  slug: 'header',
  access: { read: () => true },
  versions: { drafts: { autosave: { interval: 2000 } } },
  fields: [
    { name: 'siteName', type: 'text', defaultValue: 'Acme' },
    { name: 'tagline', type: 'text' },
    {
      name: 'nav',
      type: 'array',
      labels: { singular: 'Link', plural: 'Links' },
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'href', type: 'text', required: true },
      ],
    },
  ],
}
