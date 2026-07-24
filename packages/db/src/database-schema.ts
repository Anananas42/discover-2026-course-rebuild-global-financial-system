// The database schema: one database per institution. Every institution —
// the central bank and each commercial bank — keeps its own database (its
// own Postgres schema: `central_bank`, `bank_1`, `bank_2`, …) with the
// same four tables: `accounts` (at the central bank without a person_id
// column — only institutions bank there), `claims`, `payments` (a bank's
// record of the interbank payments it sent, each with a status), and
// `settings` (the institution's knobs, such as the policy rate). There is deliberately no
// combined table of everyone's accounts: to find an account you must know
// its bank, which is what makes settlement between separate databases a
// real thing.
// The central bank's database additionally holds `commercial_banks`, the
// register of licensed banks — the source of the `bank_<id>` schema names.
//
// The table shapes are fixed for the whole course and applied idempotently
// — `ensureSchema` on connect for the central bank, `ensureBankDatabase`
// when a bank comes online. There are no migrations, and students never
// touch this package.
//
// Money columns are bigint minor units (strings on the wire); converting
// them to Big major units is the repos' job, in their row mapping — the
// single place where units convert.

import { sql, type Generated, type Kysely } from 'kysely';

export interface CommercialBanksTable {
  id: Generated<number>;
  name: string;
}

/** A commercial bank's accounts table. */
export interface AccountsTable {
  id: Generated<number>;
  /** The externally visible account number — random, issued by the
   *  account's own institution; the serial id stays internal. */
  number: string;
  /** The holder's personal id — the person's unique identifier; empty
   *  for the bank's own account (an institution is no person). */
  personId: string;
  /** The holder's display name — a label; people may share it. */
  owner: string;
  /** Balance in minor units; bigint column, string on the wire. */
  balance: string;
}

/** The central bank's accounts table — the banks' reserve accounts and
 *  the central bank's own. Only institutions bank here, so there is no
 *  person_id column at all: the schema tells the same truth the API
 *  does. */
export interface CentralBankAccountsTable {
  id: Generated<number>;
  /** The externally visible account number — random, issued by the
   *  central bank; the serial id stays internal. */
  number: string;
  /** The holding institution's name. */
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
  /** The debited account's internal id, in the sending bank's database. */
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

// `commercial_banks` exists only in the central bank's schema; the bank
// schemas hold just the four ledger-like tables. The connection is typed
// with the banks' shape — `commercial_banks` is only ever queried through
// the central bank's schema, and the central bank's accounts table (the
// one shape that genuinely differs: no person_id) is viewed through
// `CentralBankSchema` by its own repo and nobody else.
export interface Database {
  accounts: AccountsTable;
  commercial_banks: CommercialBanksTable;
  claims: ClaimsTable;
  payments: PaymentsTable;
  settings: SettingsTable;
}

/** The central bank's schema, where its accounts table differs. */
export interface CentralBankSchema {
  accounts: CentralBankAccountsTable;
}

export const CENTRAL_BANK_SCHEMA = 'central_bank';

export function bankSchemaName(bankId: number): string {
  return `bank_${bankId}`;
}

async function ensureInstitutionTables(
  db: Kysely<Database>,
  schema: string,
  // Only institutions bank at the central bank, so its accounts table
  // carries no person_id column — the schema tells the same truth the
  // per-institution APIs do.
  { personAccounts }: { personAccounts: boolean }
): Promise<void> {
  await sql`CREATE SCHEMA IF NOT EXISTS ${sql.id(schema)}`.execute(db);
  if (personAccounts) {
    await sql`
      CREATE TABLE IF NOT EXISTS ${sql.id(schema)}.accounts (
        id serial PRIMARY KEY,
        number text NOT NULL DEFAULT '0',
        person_id text NOT NULL DEFAULT '',
        owner text NOT NULL,
        balance bigint NOT NULL DEFAULT 0
      )`.execute(db);
  } else {
    await sql`
      CREATE TABLE IF NOT EXISTS ${sql.id(schema)}.accounts (
        id serial PRIMARY KEY,
        number text NOT NULL DEFAULT '0',
        owner text NOT NULL,
        balance bigint NOT NULL DEFAULT 0
      )`.execute(db);
  }
  // Idempotent catch-ups for databases created before a column changed;
  // accounts opened back then keep the defaults until the data is reset.
  await sql`
    ALTER TABLE ${sql.id(schema)}.accounts
    ADD COLUMN IF NOT EXISTS number text NOT NULL DEFAULT '0'`.execute(db);
  if (personAccounts) {
    await sql`
      ALTER TABLE ${sql.id(schema)}.accounts
      ADD COLUMN IF NOT EXISTS person_id text NOT NULL DEFAULT ''`.execute(db);
  } else {
    // Central-bank databases created before the split carried the
    // column; it never held anything but ''.
    await sql`
      ALTER TABLE ${sql.id(schema)}.accounts
      DROP COLUMN IF EXISTS person_id`.execute(db);
  }
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

/** Creates the central bank's database (and its register) on connect. */
export async function ensureSchema(db: Kysely<Database>): Promise<void> {
  await ensureInstitutionTables(db, CENTRAL_BANK_SCHEMA, {
    personAccounts: false,
  });
  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.id(CENTRAL_BANK_SCHEMA)}.commercial_banks (
      id serial PRIMARY KEY,
      name text NOT NULL UNIQUE
    )`.execute(db);
  // Workbench state, not any institution's data: the one slot where the
  // last snapshot of every institution's rows is kept (see saveSnapshot).
  await sql`
    CREATE TABLE IF NOT EXISTS public.state_snapshot (
      id integer PRIMARY KEY,
      data jsonb NOT NULL
    )`.execute(db);
  // Idempotent catch-up: banks created before a table or column existed
  // get it on the next connect; their data is otherwise untouched.
  const banks = await db
    .withSchema(CENTRAL_BANK_SCHEMA)
    .selectFrom('commercial_banks')
    .select('id')
    .execute();
  for (const bank of banks) {
    await ensureInstitutionTables(db, bankSchemaName(bank.id), {
      personAccounts: true,
    });
  }
}

/** Creates a licensed bank's own database; idempotent like all the DDL. */
export async function ensureBankDatabase(
  db: Kysely<Database>,
  bankId: number
): Promise<void> {
  await ensureInstitutionTables(db, bankSchemaName(bankId), {
    personAccounts: true,
  });
}
