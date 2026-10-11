import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  access: { read: () => true },
  upload: { staticDir: 'media', mimeTypes: ['image/*'] },
  // Alt text doubles as the auto-mapping carrier: an <img alt> maps to its upload field.
  fields: [{ name: 'alt', type: 'text', required: true }],
}
