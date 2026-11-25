// Schema + seed. Kept free of path aliases so `scripts/migrate.ts` can run it with plain Node.
import bcrypt from "bcryptjs";

export type QueryFn = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;

export const SCHEMA_VERSION = "1";

const statements = [
  `CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS users (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     email TEXT NOT NULL UNIQUE,
     name TEXT NOT NULL,
     password_hash TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS sessions (
     token_hash TEXT PRIMARY KEY,
     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     expires_at TIMESTAMPTZ NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS documents (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     title TEXT NOT NULL,
     content_html TEXT NOT NULL DEFAULT '',
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS documents_owner_idx ON documents(owner_id)`,
  `CREATE TABLE IF NOT EXISTS document_shares (
     document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     role TEXT NOT NULL CHECK (role IN ('viewer', 'editor')),
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     PRIMARY KEY (document_id, user_id)
   )`,
  `CREATE INDEX IF NOT EXISTS document_shares_user_idx ON document_shares(user_id)`,
];

export const DEMO_PASSWORD = "demo1234";
export const DEMO_USERS = [
  { email: "alice@ajaia.test", name: "Alice Chen" },
  { email: "bob@ajaia.test", name: "Bob Rivera" },
  { email: "carol@ajaia.test", name: "Carol Okafor" },
];

const WELCOME_HTML = `<h1>Welcome to Ajaia Docs</h1>
<p>This document is owned by <strong>Alice</strong> and shared with <strong>Bob</strong> as an <em>editor</em>.</p>
<h2>Try it out</h2>
<ul><li><p>Format text with <strong>bold</strong>, <em>italic</em> and <u>underline</u></p></li><li><p>Use headings and lists from the toolbar</p></li></ul>
<ol><li><p>Changes save automatically</p></li><li><p>Sign in as Bob to see this under <em>Shared with me</em></p></li></ol>`;

/** Idempotent: creates tables, seeds demo data once, records the schema version. */
export async function migrate(query: QueryFn): Promise<void> {
  const current = await query<{ value: string }>(
    `SELECT value FROM app_meta WHERE key = 'schema_version'`,
  ).catch(() => [] as { value: string }[]);
  if (current[0]?.value === SCHEMA_VERSION) return;

  for (const stmt of statements) await query(stmt);

  // Claim the seed atomically so concurrent cold starts (serverless) can't seed twice.
  const claimed = await query(
    `INSERT INTO app_meta (key, value) VALUES ('seeded', 'true') ON CONFLICT (key) DO NOTHING RETURNING key`,
  );
  if (claimed.length > 0) {
    const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
    for (const u of DEMO_USERS) {
      await query(
        `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING`,
        [u.email, u.name, hash],
      );
    }
    const [alice] = await query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [DEMO_USERS[0].email]);
    const [bob] = await query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [DEMO_USERS[1].email]);
    const [doc] = await query<{ id: string }>(
      `INSERT INTO documents (owner_id, title, content_html) VALUES ($1, $2, $3) RETURNING id`,
      [alice.id, "Welcome to Ajaia Docs", WELCOME_HTML],
    );
    await query(`INSERT INTO document_shares (document_id, user_id, role) VALUES ($1, $2, 'editor')`, [doc.id, bob.id]);
  }

  await query(
    `INSERT INTO app_meta (key, value) VALUES ('schema_version', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [SCHEMA_VERSION],
  );
}
