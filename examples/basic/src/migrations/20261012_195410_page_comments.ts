import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`onpage_comments\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`global\` text,
  	\`path\` text,
  	\`quote\` text,
  	\`body\` text NOT NULL,
  	\`kind\` text DEFAULT 'comment',
  	\`author_id\` integer,
  	\`guest_name\` text,
  	\`link\` text,
  	\`resolved\` integer DEFAULT false,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`author_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`onpage_comments_global_idx\` ON \`onpage_comments\` (\`global\`);`)
  await db.run(sql`CREATE INDEX \`onpage_comments_author_idx\` ON \`onpage_comments\` (\`author_id\`);`)
  await db.run(sql`CREATE INDEX \`onpage_comments_link_idx\` ON \`onpage_comments\` (\`link\`);`)
  await db.run(sql`CREATE INDEX \`onpage_comments_resolved_idx\` ON \`onpage_comments\` (\`resolved\`);`)
  await db.run(sql`CREATE INDEX \`onpage_comments_updated_at_idx\` ON \`onpage_comments\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`onpage_comments_created_at_idx\` ON \`onpage_comments\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`onpage_comments_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`pages_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`onpage_comments\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`pages_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`onpage_comments_rels_order_idx\` ON \`onpage_comments_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`onpage_comments_rels_parent_idx\` ON \`onpage_comments_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`onpage_comments_rels_path_idx\` ON \`onpage_comments_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`onpage_comments_rels_pages_id_idx\` ON \`onpage_comments_rels\` (\`pages_id\`);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`onpage_comments_id\` integer REFERENCES onpage_comments(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_onpage_comments_id_idx\` ON \`payload_locked_documents_rels\` (\`onpage_comments_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`onpage_comments\`;`)
  await db.run(sql`DROP TABLE \`onpage_comments_rels\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`pages_id\` integer,
  	\`media_id\` integer,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`pages_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "pages_id", "media_id", "users_id") SELECT "id", "order", "parent_id", "path", "pages_id", "media_id", "users_id" FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_pages_id_idx\` ON \`payload_locked_documents_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
}
