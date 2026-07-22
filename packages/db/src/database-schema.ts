// The database schema: per-institution books. Every institution — the
// central bank and each commercial bank — keeps its own books in its own
// Postgres schema (`central_bank`, `bank_1`, `bank_2`, …) with the same
// tables: `accounts`, `claims`, `payments` (a bank's record of the
// interbank payments it sent, each with a status), and `settings` (the
// institution's knobs, such as the policy rate). There is deliberately no
// combined table of everyone's accounts: to find an account you must know
// its bank, which is what makes settlement between separate ledgers a
// real thing.
// The central bank's schema additionally holds `banks`, the registry of
// licensed banks — the source of the `bank_<id>` schema names.
//
// The table shapes are fixed for the whole course and applied idempotently
// — `ensureSchema` on connect for the central bank, `ensureBooks` when a
// bank is opened. There are no migrations, and students never touch this
// package.
//
// Money columns are bigint minor units (strings on the wire); converting
// them to Big major units is the Db's job, in its row mapping — the
// single place where units convert.

import { sql, type Generated, type Kysely } from 'kysely';

export interface BanksTable {
  id: Generated<number>;
  name: string;
}

export interface AccountsTable {
  id: Generated<number>;
  /** The externally visible account number — random, issued by the
   *  account's own institution; the serial id stays internal. */
  number: string;
  /** The holder's personal id — the person's unique identifier; empty
   *  for institutions' own accounts (reserve accounts have no person). */
  personId: string;
  /** The holder's display name — a label; people may share it. */
  owner: string;
  /** Balance in minor units; bigint column, string on the wire. */
  balance: string;
}

/** A claim's lifecycle: 'active' while owed; 'repaid' once paid back in
 *  full; 'written-off' once the lender gives up on it. Closed claims stay
 *  in the table as history — like a real institution, nothing is deleted —
 *  but they leave the balance sheet (only 'active' claims are counted). */
export type ClaimStatus = 'active' | 'repaid' | 'written-off';

export interface ClaimsTable {
  id: Generated<number>;
  borrower: string;
  /** Outstanding amount in minor units; bigint column, string on the wire. */
  amount: string;
  status: Generated<ClaimStatus>;
}

/** A sent payment's lifecycle: 'accepted' the moment the sending bank
 *  records the order and debits its client; 'settled' once the reserves
 *  moved at the central bank; 'completed' once the receiving bank
 *  credited the recipient. A payment stuck before 'completed' is exactly
 *  what a real bank's reconciliation hunts for. */
export type PaymentStatus = 'accepted' | 'settled' | 'completed';

export interface PaymentsTable {
  id: Generated<number>;
  /** The debited account's internal id, in the sending bank's books. */
  fromAccountId: number;
  toBankId: number;
  toAccountNumber: string;
  /** Amount in minor units; bigint column, string on the wire. */
  amount: string;
  status: Generated<PaymentStatus>;
}

/** Per-institution knobs (the policy rate lives here): plain key-value,
 *  values are strings the domain parses. */
export interface SettingsTable {
  key: string;
  value: string;
}

// `banks` exists only in the central bank's schema; the bank schemas hold
// just accounts and claims. Kysely sees one shape for all schemas — the
// Db only ever queries `banks` through the central bank's schema.
export interface Database {
  accounts: AccountsTable;
  banks: BanksTable;
  claims: ClaimsTable;
  payments: PaymentsTable;
  settings: SettingsTable;
}

export const CENTRAL_BANK_SCHEMA = 'central_bank';

export function bankSchemaName(bankId: number): string {
  return `bank_${bankId}`;
}

async function ensureBooksTables(
  db: Kysely<Database>,
  schema: string
): Promise<void> {
  await sql`CREATE SCHEMA IF NOT EXISTS ${sql.id(schema)}`.execute(db);
  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.id(schema)}.accounts (
      id serial PRIMARY KEY,
      number text NOT NULL DEFAULT '0',
      person_id text NOT NULL DEFAULT '',
      owner text NOT NULL,
      balance bigint NOT NULL DEFAULT 0
    )`.execute(db);
  // Idempotent catch-up for books created before the columns existed;
  // accounts opened back then keep the defaults until the data is reset.
  await sql`
    ALTER TABLE ${sql.id(schema)}.accounts
    ADD COLUMN IF NOT EXISTS number text NOT NULL DEFAULT '0'`.execute(db);
  await sql`
    ALTER TABLE ${sql.id(schema)}.accounts
    ADD COLUMN IF NOT EXISTS person_id text NOT NULL DEFAULT ''`.execute(db);
  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.id(schema)}.claims (
      id serial PRIMARY KEY,
      borrower text NOT NULL,
      amount bigint NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'active'
    )`.execute(db);
  // Idempotent catch-up for claims tables created before the status column.
  await sql`
    ALTER TABLE ${sql.id(schema)}.claims
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'`.execute(db);
  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.id(schema)}.payments (
      id serial PRIMARY KEY,
      from_account_id integer NOT NULL,
      to_bank_id integer NOT NULL,
      to_account_number text NOT NULL,
      amount bigint NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'accepted'
    )`.execute(db);
  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.id(schema)}.settings (
      key text PRIMARY KEY,
      value text NOT NULL
    )`.execute(db);
}

/** Creates the central bank's books (and its bank registry) on connect. */
export async function ensureSchema(db: Kysely<Database>): Promise<void> {
  await ensureBooksTables(db, CENTRAL_BANK_SCHEMA);
  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.id(CENTRAL_BANK_SCHEMA)}.banks (
      id serial PRIMARY KEY,
      name text NOT NULL UNIQUE
    )`.execute(db);
  // Workbench state, not any institution's books: the one slot where the
  // last snapshot of every institution's rows is kept (see Db.saveSnapshot).
  await sql`
    CREATE TABLE IF NOT EXISTS public.state_snapshot (
      id integer PRIMARY KEY,
      data jsonb NOT NULL
    )`.execute(db);
  // Idempotent catch-up: banks created before a table or column existed
  // get it on the next connect; their data is otherwise untouched.
  const banks = await db
    .withSchema(CENTRAL_BANK_SCHEMA)
    .selectFrom('banks')
    .select('id')
    .execute();
  for (const bank of banks) {
    await ensureBooksTables(db, bankSchemaName(bank.id));
  }
}

/** Creates an opened bank's books; idempotent like the rest of the DDL. */
export async function ensureBooks(
  db: Kysely<Database>,
  bankId: number
): Promise<void> {
  await ensureBooksTables(db, bankSchemaName(bankId));
}
