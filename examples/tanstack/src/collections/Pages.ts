import type { Block, CollectionConfig } from 'payload'

// Shown in the block pickers (the admin's and the on-page one). Live previews in
// client mode render `example` in place; inserted blocks start from their defaults
// unless `insertExample` is set.
const thumbnail = (slug: string, alt: string) => ({ url: `/blocks/${slug}.svg`, alt })

const Hero: Block = {
  slug: 'hero',
  labels: { singular: 'Hero', plural: 'Heroes' },
  admin: {
    group: 'Headers',
    images: { thumbnail: thumbnail('hero', 'A large heading with a subheading and a button') },
    custom: {
      onpage: {
        example: {
          heading: 'Your big idea, front and center',
          subheading: 'One or two sentences that say what this page is about.',
          cta: { label: 'Get started', url: '#' },
        },
      },
    },
  },
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
  admin: {
    images: { thumbnail: thumbnail('content', 'A heading followed by paragraphs of text') },
  },
  fields: [{ name: 'body', type: 'richText' }],
}

const Features: Block = {
  slug: 'features',
  labels: { singular: 'Features', plural: 'Features' },
  admin: {
    images: { thumbnail: thumbnail('features', 'A heading over three feature cards') },
    custom: {
      onpage: {
        example: {
          heading: 'Why people choose us',
          items: [
            { title: 'Fast', description: 'Pages load in a blink.', icon: 'bolt' },
            { title: 'Friendly', description: 'Edit right on the page.', icon: 'heart' },
            {
              title: 'Reliable',
              description: 'Drafts, versions and access control.',
              icon: 'star',
            },
          ],
        },
        // A new Features section starts with this content (Hero's example is preview-only).
        insertExample: true,
      },
    },
  },
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
  // schedulePublish: "Schedule for later" in the on-page publish menu, as in the admin.
  versions: { drafts: { autosave: { interval: 2000 }, schedulePublish: true } },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'publishedAt', type: 'date' },
    { name: 'author', type: 'relationship', relationTo: 'users' },
    // Admin-only field, never rendered: proves field-level access in e2e.
    {
      name: 'internalNote',
      type: 'textarea',
      access: { update: ({ req }) => req.user?.role === 'admin' },
    },
    // A custom field editor, picked per field:
    {
      name: 'accent',
      type: 'text',
      defaultValue: '#4f46e5',
      admin: { custom: { onpage: { editor: 'color' } } },
    },
    // Render this page from editor state (instant edits) instead of refreshing from the server.
    { name: 'instant', type: 'checkbox', label: 'Client-mode demo' },
    { name: 'layout', type: 'blocks', blocks: [Hero, Content, Features] },
  ],
}
