import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { onpage } from '@payload-onpage/plugin'
import { tanstackSession } from '@payload-onpage/tanstack-start/session'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Users } from './collections/Users'
import { Header } from './globals/Header'
import { seed } from './seed'
import { PAYLOAD_SECRET } from './secret'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfig({
  secret: PAYLOAD_SECRET,
  serverURL: process.env.SERVER_URL || 'http://localhost:3102',
  admin: {
    user: Users.slug,
    importMap: { baseDir: dirname },
    // Example only: sign in automatically during development.
    autoLogin:
      process.env.NODE_ENV === 'development'
        ? { email: 'dev@example.com', password: 'test' }
        : false,
  },
  collections: [Pages, Media, Users],
  globals: [Header],
  editor: lexicalEditor(),
  // Dev pushes the schema automatically; production runs migrations on start.
  db: sqliteAdapter({
    client: { url: process.env.DATABASE_URL || `file:${path.resolve(dirname, '../payload.db')}` },
  }),
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  plugins: [
    onpage({
      collections: ['pages'],
      globals: ['header'],
      session: tanstackSession({ secret: PAYLOAD_SECRET }),
      // Comments on pages and review requests; share-link viewers can comment too.
      comments: { guests: true },
      // A real site would email or message its reviewers here.
      onReviewRequest: ({ req, note, url }) =>
        req.payload.logger.info(`Review requested${note ? `: ${note}` : ''} ${url}`),
    }),
  ],
  onInit: seed,
})
