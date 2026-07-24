// The whole financial system's persistence, as only the harness sees
// it: the central bank's database, a handle to any commercial bank's
// database, and the debug methods (`dump`, `reset`, and the
// `saveSnapshot`/`restoreSnapshot` pair behind the revert-to-balanced
// button) — they bypass the domain on purpose, so they stay truthful
// even when domain code is broken. No institution ever holds this: a
// task gets exactly its own institution's handle (CentralBankDb or
// CommercialBankDb) and reaches other institutions only through their
// APIs, the way the real world works.

import type { Kysely, Selectable } from 'kysely';
import { sql } from 'kysely';

import { CentralBankDb } from './central-bank-db.ts';
import { CommercialBankDb } from './commercial-bank-db.ts';
import type {
  AccountsTable,
  ClaimsTable,
  Database,
  PaymentsTable,
  SettingsTable,
} from './database-schema.ts';
import {
  bankSchemaName,
  CENTRAL_BANK_SCHEMA,
  ensureBankDatabase,
} from './database-schema.ts';
import type { CommercialBank } from './repos/commercial-bank-repo.ts';

export interface DumpedTable {
  name: string;
  columns: string[];
  /** Rows verbatim — amounts stay minor-unit strings here. */
  rows: string[][];
}

export interface DumpedDatabase {
  /** Display label: 'Central bank' or the bank's registered name. */
  institution: string;
  schema: string;
  tables: DumpedTable[];
}

/** An account row as stored: person_id exists only in banks' tables —
 *  the central bank's accounts table has no such column. */
type AccountRow = Omit<Selectable<AccountsTable>, 'personId'> & {
  personId?: string;
};

/** One institution's rows, verbatim — amounts stay minor-unit strings. */
interface InstitutionRows {
  accounts: AccountRow[];
  claims: Selectable<ClaimsTable>[];
  payments: Selectable<PaymentsTable>[];
  settings: Selectable<SettingsTable>[];
}

/** The whole system's rows, verbatim — what `saveSnapshot` stores and
 *  `restoreSnapshot` brings back, ids included. `bankId` is null for
 *  the central bank's own database. */
interface StateSnapshot {
  commercialBanks: CommercialBank[];
  databases: { bankId: number | null; rows: InstitutionRows }[];
}

function schemaFor(bankId: number | null): string {
  return bankId === null ? CENTRAL_BANK_SCHEMA : bankSchemaName(bankId);
}

export class FinancialSystemDb {
  /** The central bank's own database. */
  readonly centralBank: CentralBankDb;
  private readonly dbConnection: Kysely<Database>;

  constructor(dbConnection: Kysely<Database>) {
    this.dbConnection = dbConnection;
    this.centralBank = new CentralBankDb(dbConnection);
  }

  /** One commercial bank's own database, by the bank's register id. */
  commercialBank(bankId: number): CommercialBankDb {
    return new CommercialBankDb(this.dbConnection, bankId);
  }

  /** Every institution's tables, verbatim — amounts in minor units. */
  async dump(): Promise<DumpedDatabase[]> {
    const banks = await this.centralBank.commercialBanks.list();
    const result: DumpedDatabase[] = [
      {
        institution: 'Central bank',
        schema: CENTRAL_BANK_SCHEMA,
        tables: [
          {
            name: 'commercial_banks',
            columns: ['id', 'name'],
            rows: banks.map(bank => [String(bank.id), bank.name]),
          },
          ...(await this.dumpInstitutionTables(null)),
        ],
      },
    ];
    for (const bank of banks) {
      result.push({
        institution: bank.name,
        schema: bankSchemaName(bank.id),
        tables: await this.dumpInstitutionTables(bank.id),
      });
    }
    return result;
  }

  /** All four tables of one institution's database, rows verbatim. */
  private async readRows(
    connection: Kysely<Database>,
    bankId: number | null
  ): Promise<InstitutionRows> {
    const scoped = connection.withSchema(schemaFor(bankId));
    // The central bank's accounts rows simply come back without a
    // personId — its table has no such column.
    const [accounts, claims, payments, settings] = await Promise.all([
      scoped.selectFrom('accounts').selectAll().orderBy('id').execute(),
      scoped.selectFrom('claims').selectAll().orderBy('id').execute(),
      scoped.selectFrom('payments').selectAll().orderBy('id').execute(),
      scoped.selectFrom('settings').selectAll().orderBy('key').execute(),
    ]);
    return { accounts, claims, payments, settings };
  }

  private async dumpInstitutionTables(
    bankId: number | null
  ): Promise<DumpedTable[]> {
    const { accounts, claims, payments, settings } = await this.readRows(
      this.dbConnection,
      bankId
    );
    return [
      // The central bank's accounts table has no person_id column —
      // only institutions bank there — so its dump shows none either.
      bankId === null
        ? {
            name: 'accounts',
            columns: ['id', 'number', 'owner', 'balance'],
            rows: accounts.map(row => [
              String(row.id),
              row.number,
              row.owner,
              row.balance,
            ]),
          }
        : {
            name: 'accounts',
            columns: ['id', 'number', 'person_id', 'owner', 'balance'],
            rows: accounts.map(row => [
              String(row.id),
              row.number,
              row.personId ?? '',
              row.owner,
              row.balance,
            ]),
          },
      {
        name: 'claims',
        columns: ['id', 'borrower', 'amount', 'status'],
        rows: claims.map(row => [
          String(row.id),
          row.borrower,
          row.amount,
          row.status,
        ]),
      },
      {
        name: 'payments',
        columns: [
          'id',
          'from_account_id',
          'to_bank_id',
          'to_account_number',
          'amount',
          'status',
        ],
        rows: payments.map(row => [
          String(row.id),
          String(row.fromAccountId),
          String(row.toBankId),
          row.toAccountNumber,
          row.amount,
          row.status,
        ]),
      },
      {
        name: 'settings',
        columns: ['key', 'value'],
        rows: settings.map(row => [row.key, row.value]),
      },
    ];
  }

  /** Deletes every row of every institution and drops the banks'
   *  databases. */
  async reset(): Promise<void> {
    await this.dbConnection.transaction().execute(trx => this.wipe(trx));
  }

  /** Drops every bank's schema and empties the central bank's tables. */
  private async wipe(trx: Kysely<Database>): Promise<void> {
    const banks = await trx
      .withSchema(CENTRAL_BANK_SCHEMA)
      .selectFrom('commercial_banks')
      .select('id')
      .execute();
    for (const bank of banks) {
      await sql`DROP SCHEMA IF EXISTS ${sql.id(bankSchemaName(bank.id))} CASCADE`.execute(
        trx
      );
    }
    await sql`TRUNCATE ${sql.id(CENTRAL_BANK_SCHEMA)}.commercial_banks, ${sql.id(CENTRAL_BANK_SCHEMA)}.accounts, ${sql.id(CENTRAL_BANK_SCHEMA)}.claims, ${sql.id(CENTRAL_BANK_SCHEMA)}.payments, ${sql.id(CENTRAL_BANK_SCHEMA)}.settings RESTART IDENTITY`.execute(
      trx
    );
  }

  /** Stores a verbatim copy of every institution's rows in the single
   *  snapshot slot, overwriting the previous one. The financial system API
   *  keeps the slot holding the last state in which every balance sheet
   *  balanced — the state `restoreSnapshot` reverts to. */
  async saveSnapshot(): Promise<void> {
    // Repeatable read: the copy is one moment's state even if operations
    // land between the table reads.
    const snapshot = await this.dbConnection
      .transaction()
      .setIsolationLevel('repeatable read')
      .execute(async (trx): Promise<StateSnapshot> => {
        const banks = await trx
          .withSchema(CENTRAL_BANK_SCHEMA)
          .selectFrom('commercial_banks')
          .selectAll()
          .orderBy('id')
          .execute();
        const databases: StateSnapshot['databases'] = [
          { bankId: null, rows: await this.readRows(trx, null) },
        ];
        for (const bank of banks) {
          databases.push({
            bankId: bank.id,
            rows: await this.readRows(trx, bank.id),
          });
        }
        return { commercialBanks: banks, databases };
      });
    await sql`
      INSERT INTO public.state_snapshot (id, data)
      VALUES (1, ${JSON.stringify(snapshot)}::jsonb)
      ON CONFLICT (id) DO UPDATE SET data = excluded.data
    `.execute(this.dbConnection);
  }

  /** Replaces the whole system's state with the stored snapshot — every
   *  row under every id exactly as saved. False when no snapshot has been
   *  stored yet. */
  async restoreSnapshot(): Promise<boolean> {
    const stored = await sql<{ data: StateSnapshot | LegacySnapshot }>`
      SELECT data FROM public.state_snapshot WHERE id = 1
    `.execute(this.dbConnection);
    const raw = stored.rows[0]?.data;
    if (!raw) return false;
    const snapshot = migrateSnapshot(raw);
    // One transaction, because reads run concurrently and some write: a
    // missing rate key is written back as a default (policyRate,
    // interestRate), and between a wipe and the re-insert that default
    // would collide with the restored row. Atomic restore leaves
    // concurrent writers either before the wipe or after the commit.
    await this.dbConnection.transaction().execute(async trx => {
      await this.wipe(trx);
      if (snapshot.commercialBanks.length > 0) {
        await trx
          .withSchema(CENTRAL_BANK_SCHEMA)
          .insertInto('commercial_banks')
          .values(snapshot.commercialBanks)
          .execute();
      }
      for (const bank of snapshot.commercialBanks) {
        await ensureBankDatabase(trx, bank.id);
      }
      for (const database of snapshot.databases) {
        await this.restoreRows(trx, database.bankId, database.rows);
      }
      await this.restartSequence(trx, CENTRAL_BANK_SCHEMA, 'commercial_banks');
    });
    return true;
  }

  /** Re-inserts one institution's rows and re-arms its id sequences so
   *  later inserts continue past the restored ids. */
  private async restoreRows(
    trx: Kysely<Database>,
    bankId: number | null,
    rows: InstitutionRows
  ): Promise<void> {
    const scoped = trx.withSchema(schemaFor(bankId));
    if (rows.accounts.length > 0) {
      await scoped
        .insertInto('accounts')
        // The rows carry exactly their institution's columns — central
        // bank rows have no personId key (migrateSnapshot strips it
        // from legacy slots), bank rows always do.
        .values(rows.accounts as Selectable<AccountsTable>[])
        .execute();
    }
    if (rows.claims.length > 0) {
      await scoped.insertInto('claims').values(rows.claims).execute();
    }
    if (rows.payments.length > 0) {
      await scoped.insertInto('payments').values(rows.payments).execute();
    }
    if (rows.settings.length > 0) {
      await scoped.insertInto('settings').values(rows.settings).execute();
    }
    for (const table of ['accounts', 'claims', 'payments'] as const) {
      await this.restartSequence(trx, schemaFor(bankId), table);
    }
  }

  /** Points a table's serial id sequence right past the highest id. */
  private async restartSequence(
    connection: Kysely<Database>,
    schema: string,
    table: string
  ): Promise<void> {
    await sql`
      SELECT setval(
        pg_get_serial_sequence(${`${schema}.${table}`}, 'id'),
        (SELECT coalesce(max(id), 0) + 1 FROM ${sql.id(schema)}.${sql.id(table)}),
        false
      )`.execute(connection);
  }

  /** Close the connection pool. */
  destroy(): Promise<void> {
    return this.dbConnection.destroy();
  }
}

/** The snapshot format before per-institution handles: ledgers keyed by
 *  a `books` selector ('central-bank' or a bank id). A slot written by
 *  the previous code restores once, then gets overwritten in the new
 *  format. */
interface LegacySnapshot {
  commercialBanks: CommercialBank[];
  ledgers: { books: 'central-bank' | number; rows: InstitutionRows }[];
}

function migrateSnapshot(raw: StateSnapshot | LegacySnapshot): StateSnapshot {
  const snapshot: StateSnapshot =
    'databases' in raw
      ? raw
      : {
          commercialBanks: raw.commercialBanks,
          databases: raw.ledgers.map(ledger => ({
            bankId: ledger.books === 'central-bank' ? null : ledger.books,
            rows: ledger.rows,
          })),
        };
  // Central-bank account rows saved before the person_id column was
  // dropped still carry it (always ''); the table no longer has the
  // column, so the key goes.
  for (const database of snapshot.databases) {
    if (database.bankId !== null) continue;
    database.rows.accounts = database.rows.accounts.map(
      ({ personId: _legacy, ...row }) => row
    );
  }
  return snapshot;
}
