import "server-only";
import path from "node:path";
import fs from "node:fs";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import * as schema from "./schema";

// Local development uses an embedded Postgres (PGlite) stored in DATA_DIR.
// Production sets DATABASE_URL (e.g. Supabase pooler, port 6543).
type DB = ReturnType<typeof drizzlePglite<typeof schema>>;

// turbopackIgnore: these are runtime paths, not files to bundle (migrations are included via next.config)
export const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || ".data");
const MIGRATIONS = path.join(/*turbopackIgnore: true*/ process.cwd(), "drizzle");

const g = globalThis as unknown as { __damaDb?: Promise<DB> };

async function create(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const postgres = (await import("postgres")).default;
    const client = postgres(url, { prepare: false, max: 5 });
    const db = drizzlePostgres(client, { schema });
    if (process.env.AUTO_MIGRATE !== "false") await migratePostgres(db, { migrationsFolder: MIGRATIONS });
    return db as unknown as DB;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const client = new PGlite(path.join(DATA_DIR, "pglite"));
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS });
  return db;
}

export function getDb(): Promise<DB> {
  if (!g.__damaDb) g.__damaDb = create();
  return g.__damaDb;
}

export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { schema };
