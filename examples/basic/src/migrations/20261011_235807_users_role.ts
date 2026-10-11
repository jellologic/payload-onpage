import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`pages\` ADD \`internal_note\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v\` ADD \`version_internal_note\` text;`)
  await db.run(sql`ALTER TABLE \`users\` ADD \`role\` text DEFAULT 'editor';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`pages\` DROP COLUMN \`internal_note\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v\` DROP COLUMN \`version_internal_note\`;`)
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`role\`;`)
}
