import "server-only";
import { neon } from "@neondatabase/serverless";
import { migrate, type QueryFn } from "./schema";

export interface Db {
  query: QueryFn;
}

/** Postgres over Neon's HTTP driver: stateless, one round trip per query, ideal for serverless. */
function neonDb(url: string): Db {
  const sql = neon(url);
  return {
    query: async <T,>(text: string, params: unknown[] = []) => (await sql.query(text, params)) as T[],
  };
}

/** Embedded Postgres (WASM) for zero-config local dev and tests. `dataDir` undefined = in-memory. */
export async function pgliteDb(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (dataDir) (await import("node:fs")).mkdirSync(dataDir, { recursive: true });
  const pg = new PGlite(dataDir);
  return {
    query: async <T,>(text: string, params: unknown[] = []) => (await pg.query<T>(text, params)).rows,
  };
}

const globalForDb = globalThis as unknown as { __dbPromise?: Promise<Db> };

/** Process-wide DB handle; schema is ensured once per instance. */
export function getDb(): Promise<Db> {
  if (!globalForDb.__dbPromise) {
    globalForDb.__dbPromise = (async () => {
      const url = process.env.DATABASE_URL;
      const db = url ? neonDb(url) : await pgliteDb(process.env.PGLITE_DIR ?? "./.data/pglite");
      await migrate(db.query);
      return db;
    })().catch((err) => {
      globalForDb.__dbPromise = undefined; // allow retry on next request
      throw err;
    });
  }
  return globalForDb.__dbPromise;
}
