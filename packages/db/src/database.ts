// Connection plumbing: driver configuration, the Kysely instance, and
// `connect()`, the one entry point the rest of the project uses.

import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

import type { Database } from './database-schema.ts';
import { ensureSchema } from './database-schema.ts';
import { Db } from './bank-db.ts';

// Amounts are bigint columns and stay strings at the driver level; the
// Db converts them to Big — money never passes through JS floats.

const DEFAULT_URL = 'postgres://bank:bank@localhost:5433/bank';

export function databaseUrl(): string {
  return process.env.DATABASE_URL ?? DEFAULT_URL;
}

/** Connect, make sure the schema exists, and return a Db. */
export async function connect(url: string = databaseUrl()): Promise<Db> {
  const dbConnection = new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString: url, max: 5 }),
    }),
    plugins: [new CamelCasePlugin()],
  });
  await ensureSchema(dbConnection);
  return new Db(dbConnection);
}
