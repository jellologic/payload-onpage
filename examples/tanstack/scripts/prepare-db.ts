/**
 * Create the database's tables and seed it, for running the production build
 * (`node .output/server/index.mjs`) on a fresh SQLite file. The build doesn't
 * push the schema (only development does), and this example keeps no
 * migrations. Run with `bun run prepare:db`; DATABASE_URL picks the file.
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'

const payload = await getPayload({ config }) // pushes the schema; onInit seeds
await payload.destroy()
process.exit(0)
