import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: { useAsTitle: 'name' },
  fields: [
    { name: 'name', type: 'text' },
    {
      name: 'role',
      type: 'select',
      options: ['admin', 'editor'],
      defaultValue: 'editor',
      // Editors must not promote themselves; admins assign roles.
      access: { update: ({ req }) => req.user?.role === 'admin' },
    },
  ],
}
