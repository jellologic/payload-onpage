import type { Block, CollectionConfig } from 'payload'

const Hero: Block = {
  slug: 'hero',
  labels: { singular: 'Hero', plural: 'Heroes' },
  fields: [
    { name: 'heading', type: 'text', required: true },
    { name: 'subheading', type: 'textarea' },
    { name: 'image', type: 'upload', relationTo: 'media' },
    {
      name: 'cta',
      type: 'group',
      fields: [
        { name: 'label', type: 'text' },
        { name: 'url', type: 'text' },
      ],
    },
    {
      name: 'tone',
      type: 'select',
      defaultValue: 'light',
      options: [
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
      ],
    },
  ],
}

const Content: Block = {
  slug: 'content',
  labels: { singular: 'Content', plural: 'Content' },
  fields: [{ name: 'body', type: 'richText' }],
}

const Features: Block = {
  slug: 'features',
  labels: { singular: 'Features', plural: 'Features' },
  fields: [
    { name: 'heading', type: 'text' },
    {
      name: 'columns',
      type: 'select',
      defaultValue: '3',
      options: [
        { label: 'Two', value: '2' },
        { label: 'Three', value: '3' },
      ],
    },
    {
      name: 'items',
      type: 'array',
      labels: { singular: 'Feature', plural: 'Features' },
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'description', type: 'textarea' },
        {
          name: 'icon',
          type: 'select',
          defaultValue: 'star',
          options: [
            { label: 'Star', value: 'star' },
            { label: 'Bolt', value: 'bolt' },
            { label: 'Heart', value: 'heart' },
          ],
        },
      ],
    },
  ],
}

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    // payload-onpage uses this to find the page that shows a document.
    preview: (doc) => (doc?.slug === 'home' ? '/' : `/${doc?.slug ?? ''}`),
  },
  access: { read: () => true },
  versions: { drafts: { autosave: { interval: 2000 } } },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'publishedAt', type: 'date' },
    { name: 'author', type: 'relationship', relationTo: 'users' },
    // A custom field editor, picked per field:
    { name: 'accent', type: 'text', defaultValue: '#4f46e5', admin: { custom: { onpage: { editor: 'color' } } } },
    // Render this page from editor state (instant edits) instead of refreshing from the server.
    { name: 'instant', type: 'checkbox', label: 'Client-mode demo' },
    { name: 'layout', type: 'blocks', blocks: [Hero, Content, Features] },
  ],
}
