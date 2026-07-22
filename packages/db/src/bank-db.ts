// The persistence layer, split into one repository per table — the shape
// the Db API panel already showed and the shape real projects use. Each
// repo is deliberately dumb: reading and writing rows is its job; every
// check and invariant is the responsibility of the code calling it.
//
// The repos share one Postgres connection and one rule about money: they
// are the single place where units convert — the domain speaks major
// currency units (Big values), the database stores whole minor units
// (10^decimals per major unit, from the configured currency — see
// currency-config.ts), and money never passes through JS floats.
//
// Methods that touch an institution's books take a `Books` handle in
// their input: 'central-bank' or a bank id, resolved to that
// institution's Postgres schema. Every repo method takes one input
// object, so a call site names every field it passes — nothing can be
// swapped silently. The `Db` container bundles the five repos plus the
// debug methods (`dump`, `reset`, and the `saveSnapshot`/`restoreSnapshot`
// pair behind the revert-to-balanced button) — they bypass the domain on
// purpose, so they stay truthful even when domain code is broken.

import Big from 'big.js';
import type { Kysely, Selectable } from 'kysely';
import { sql } from 'kysely';

import { currencyDecimals } from './currency-config.ts';
import type {
  AccountsTable,
  ClaimStatus,
  ClaimsTable,
  Database,
  PaymentStatus,
  PaymentsTable,
  SettingsTable,
} from './database-schema.ts';
import {
  bankSchemaName,
  CENTRAL_BANK_SCHEMA,
  ensureBooks,
} from './database-schema.ts';

/** Whose books to touch: the central bank's, or a commercial bank's. */
export type Books = 'central-bank' | number;

/** The five repositories, one per table. The `Db` container carries one
 *  set for everyday calls; `Db.transaction` hands out a second set bound
 *  to one open transaction. */
export interface Repos {
  banks: BankRepo;
  accounts: AccountRepo;
  claims: ClaimRepo;
  payments: PaymentRepo;
  settings: SettingRepo;
}

export interface Bank {
  id: number;
  name: string;
}

export interface Account {
  id: number;
  /** The externally visible, randomly issued account number. */
  number: string;
  /** The holder's personal id; empty for institutions' own accounts. */
  personId: string;
  /** The holder's display name — a label; people may share it. */
  owner: string;
  balance: Big;
}

export interface Claim {
  id: number;
  borrower: string;
  amount: Big;
  status: ClaimStatus;
}

export interface Payment {
  id: number;
  /** The debited account's internal id, in the sending bank's books. */
  fromAccountId: number;
  toBankId: number;
  toAccountNumber: string;
  amount: Big;
  status: PaymentStatus;
}

export interface DumpedTable {
  name: string;
  columns: string[];
  /** Rows verbatim — amounts stay minor-unit strings here. */
  rows: string[][];
}

export interface DumpedBooks {
  /** Display label: 'Central bank' or the bank's registered name. */
  institution: string;
  schema: string;
  tables: DumpedTable[];
}

/** One institution's rows, verbatim — amounts stay minor-unit strings. */
interface LedgerRows {
  accounts: Selectable<AccountsTable>[];
  claims: Selectable<ClaimsTable>[];
  payments: Selectable<PaymentsTable>[];
  settings: Selectable<SettingsTable>[];
}

/** The whole system's rows, verbatim — what `saveSnapshot` stores and
 *  `restoreSnapshot` brings back, ids included. */
interface StateSnapshot {
  banks: Bank[];
  ledgers: { books: Books; rows: LedgerRows }[];
}

function schemaOf(books: Books): string {
  return books === 'central-bank' ? CENTRAL_BANK_SCHEMA : bankSchemaName(books);
}

/** Shared by every repo: the connection, the schema-scoping helper, and
 *  the one place minor↔major units convert. */
abstract class Repo {
  protected readonly dbConnection: Kysely<Database>;
  private readonly minorFactor: Big;

  constructor(dbConnection: Kysely<Database>) {
    this.dbConnection = dbConnection;
    this.minorFactor = new Big(10).pow(currencyDecimals());
  }

  /** The connection scoped to an institution's Postgres schema. */
  protected scoped(books: Books): Kysely<Database> {
    return this.dbConnection.withSchema(schemaOf(books));
  }

  protected toMinor(amount: Big): string {
    return amount.times(this.minorFactor).toFixed(0);
  }

  protected toMajor(minor: string): Big {
    return new Big(minor).div(this.minorFactor);
  }
}

/** The bank registry — a single table in the central bank's schema. */
export class BankRepo extends Repo {
  /** Registers the bank and creates its (empty) books. */
  async create({ name }: { name: string }): Promise<Bank> {
    const row = await this.scoped('central-bank')
      .insertInto('banks')
      .values({ name })
      .returningAll()
      .executeTakeFirstOrThrow();
    await ensureBooks(this.dbConnection, row.id);
    return row;
  }

  async get({ id }: { id: number }): Promise<Bank | undefined> {
    return this.scoped('central-bank')
      .selectFrom('banks')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
  }

  async getByName({ name }: { name: string }): Promise<Bank | undefined> {
    return this.scoped('central-bank')
      .selectFrom('banks')
      .selectAll()
      .where('name', '=', name)
      .executeTakeFirst();
  }

  async list(): Promise<Bank[]> {
    return this.scoped('central-bank')
      .selectFrom('banks')
      .selectAll()
      .orderBy('id')
      .execute();
  }
}

/** Deposit and reserve accounts in an institution's books. */
export class AccountRepo extends Repo {
  async create({
    books,
    owner,
    number,
    personId,
  }: {
    books: Books;
    owner: string;
    number: string;
    personId: string;
  }): Promise<Account> {
    const row = await this.scoped(books)
      .insertInto('accounts')
      .values({ owner, number, personId, balance: '0' })
      .returningAll()
      .executeTakeFirstOrThrow();
    return { ...row, balance: this.toMajor(row.balance) };
  }

  async listByPersonId({
    books,
    personId,
  }: {
    books: Books;
    personId: string;
  }): Promise<Account[]> {
    const rows = await this.scoped(books)
      .selectFrom('accounts')
      .selectAll()
      .where('personId', '=', personId)
      .orderBy('id')
      .execute();
    return rows.map(row => ({ ...row, balance: this.toMajor(row.balance) }));
  }

  async getByNumber({
    books,
    number,
  }: {
    books: Books;
    number: string;
  }): Promise<Account | undefined> {
    const row = await this.scoped(books)
      .selectFrom('accounts')
      .selectAll()
      .where('number', '=', number)
      .executeTakeFirst();
    return row && { ...row, balance: this.toMajor(row.balance) };
  }

  async get({
    books,
    id,
  }: {
    books: Books;
    id: number;
  }): Promise<Account | undefined> {
    const row = await this.scoped(books)
      .selectFrom('accounts')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row && { ...row, balance: this.toMajor(row.balance) };
  }

  async getByOwner({
    books,
    owner,
  }: {
    books: Books;
    owner: string;
  }): Promise<Account | undefined> {
    const row = await this.scoped(books)
      .selectFrom('accounts')
      .selectAll()
      .where('owner', '=', owner)
      // Deterministic pick: without an order, Postgres returns heap
      // order, which changes as rows are updated.
      .orderBy('id')
      .executeTakeFirst();
    return row && { ...row, balance: this.toMajor(row.balance) };
  }

  async list({ books }: { books: Books }): Promise<Account[]> {
    const rows = await this.scoped(books)
      .selectFrom('accounts')
      .selectAll()
      .orderBy('id')
      .execute();
    return rows.map(row => ({ ...row, balance: this.toMajor(row.balance) }));
  }

  async setBalance({
    books,
    id,
    balance,
  }: {
    books: Books;
    id: number;
    balance: Big;
  }): Promise<void> {
    await this.scoped(books)
      .updateTable('accounts')
      .set({ balance: this.toMinor(balance) })
      .where('id', '=', id)
      .execute();
  }

  async setOwner({
    books,
    id,
    owner,
  }: {
    books: Books;
    id: number;
    owner: string;
  }): Promise<void> {
    await this.scoped(books)
      .updateTable('accounts')
      .set({ owner })
      .where('id', '=', id)
      .execute();
  }
}

/** Loans owed to an institution. The borrower is an id, never a label:
 *  a bank id in the central bank's books, a personal id in a bank's —
 *  views resolve display names. Closed claims (repaid, written-off) stay
 *  in the table as history but leave the live set every read here returns —
 *  a real institution archives, it does not delete. */
export class ClaimRepo extends Repo {
  async create({
    books,
    borrower,
    amount,
  }: {
    books: Books;
    borrower: string;
    amount: Big;
  }): Promise<Claim> {
    const row = await this.scoped(books)
      .insertInto('claims')
      .values({ borrower, amount: this.toMinor(amount) })
      .returningAll()
      .executeTakeFirstOrThrow();
    return { ...row, amount: this.toMajor(row.amount) };
  }

  /** The borrower's live claim — the one still owed. A borrower who paid
   *  off and borrows again gets a fresh claim, not the closed one. */
  async getByBorrower({
    books,
    borrower,
  }: {
    books: Books;
    borrower: string;
  }): Promise<Claim | undefined> {
    const row = await this.scoped(books)
      .selectFrom('claims')
      .selectAll()
      .where('borrower', '=', borrower)
      .where('status', '=', 'active')
      .executeTakeFirst();
    return row && { ...row, amount: this.toMajor(row.amount) };
  }

  /** The live claims — what is still owed. Closed claims are history,
   *  visible only in the raw dump, never on a balance sheet. */
  async list({ books }: { books: Books }): Promise<Claim[]> {
    const rows = await this.scoped(books)
      .selectFrom('claims')
      .selectAll()
      .where('status', '=', 'active')
      .orderBy('id')
      .execute();
    return rows.map(row => ({ ...row, amount: this.toMajor(row.amount) }));
  }

  async setAmount({
    books,
    id,
    amount,
  }: {
    books: Books;
    id: number;
    amount: Big;
  }): Promise<void> {
    await this.scoped(books)
      .updateTable('claims')
      .set({ amount: this.toMinor(amount) })
      .where('id', '=', id)
      .execute();
  }

  /** Close a claim by setting its status — 'repaid' or 'written-off'.
   *  The row stays as history; it just leaves the live set. */
  async setStatus({
    books,
    id,
    status,
  }: {
    books: Books;
    id: number;
    status: ClaimStatus;
  }): Promise<void> {
    await this.scoped(books)
      .updateTable('claims')
      .set({ status })
      .where('id', '=', id)
      .execute();
  }
}

/** A bank's record of the interbank payments it sent — one row per
 *  payment order, created 'accepted' and advanced by status as the
 *  payment settles and completes. The row is the sending bank's own
 *  evidence of what it set in motion; a crash can strand the ledgers
 *  mid-payment, and this table is what explains the difference. */
export class PaymentRepo extends Repo {
  async create({
    books,
    fromAccountId,
    toBankId,
    toAccountNumber,
    amount,
  }: {
    books: Books;
    fromAccountId: number;
    toBankId: number;
    toAccountNumber: string;
    amount: Big;
  }): Promise<Payment> {
    const row = await this.scoped(books)
      .insertInto('payments')
      .values({
        fromAccountId,
        toBankId,
        toAccountNumber,
        amount: this.toMinor(amount),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return { ...row, amount: this.toMajor(row.amount) };
  }

  async setStatus({
    books,
    id,
    status,
  }: {
    books: Books;
    id: number;
    status: PaymentStatus;
  }): Promise<void> {
    await this.scoped(books)
      .updateTable('payments')
      .set({ status })
      .where('id', '=', id)
      .execute();
  }

  async list({ books }: { books: Books }): Promise<Payment[]> {
    const rows = await this.scoped(books)
      .selectFrom('payments')
      .selectAll()
      .orderBy('id')
      .execute();
    return rows.map(row => ({ ...row, amount: this.toMajor(row.amount) }));
  }
}

/** An institution's knobs, as key-value rows — the policy rate lives here. */
export class SettingRepo extends Repo {
  async get({
    books,
    key,
  }: {
    books: Books;
    key: string;
  }): Promise<string | undefined> {
    const row = await this.scoped(books)
      .selectFrom('settings')
      .selectAll()
      .where('key', '=', key)
      .executeTakeFirst();
    return row?.value;
  }

  async set({
    books,
    key,
    value,
  }: {
    books: Books;
    key: string;
    value: string;
  }): Promise<void> {
    await this.scoped(books)
      .insertInto('settings')
      .values({ key, value })
      .onConflict(conflict => conflict.column('key').doUpdateSet({ value }))
      .execute();
  }
}

/** The persistence layer as a whole: the five repos, plus the debug
 *  methods that power the Database view, its reset button, and the
 *  revert to the last balanced state. */
export class Db implements Repos {
  readonly banks: BankRepo;
  readonly accounts: AccountRepo;
  readonly claims: ClaimRepo;
  readonly payments: PaymentRepo;
  readonly settings: SettingRepo;
  private readonly dbConnection: Kysely<Database>;

  constructor(dbConnection: Kysely<Database>) {
    this.dbConnection = dbConnection;
    this.banks = new BankRepo(dbConnection);
    this.accounts = new AccountRepo(dbConnection);
    this.claims = new ClaimRepo(dbConnection);
    this.payments = new PaymentRepo(dbConnection);
    this.settings = new SettingRepo(dbConnection);
  }

  /**
   * Runs `fn` with the repos bound to one database transaction: every
   * write made through `tx` lands together — if anything inside throws,
   * none of them do. A single write is already atomic on its own; a step
   * with more than one write belongs in here.
   */
  async transaction<T>(fn: (tx: Repos) => Promise<T>): Promise<T> {
    return this.dbConnection.transaction().execute(trx =>
      fn({
        banks: new BankRepo(trx),
        accounts: new AccountRepo(trx),
        claims: new ClaimRepo(trx),
        payments: new PaymentRepo(trx),
        settings: new SettingRepo(trx),
      })
    );
  }

  /** Every institution's books, verbatim — amounts in minor units. */
  async dump(): Promise<DumpedBooks[]> {
    const banks = await this.banks.list();
    const result: DumpedBooks[] = [
      {
        institution: 'Central bank',
        schema: CENTRAL_BANK_SCHEMA,
        tables: [
          {
            name: 'banks',
            columns: ['id', 'name'],
            rows: banks.map(bank => [String(bank.id), bank.name]),
          },
          ...(await this.dumpBooksTables('central-bank')),
        ],
      },
    ];
    for (const bank of banks) {
      result.push({
        institution: bank.name,
        schema: bankSchemaName(bank.id),
        tables: await this.dumpBooksTables(bank.id),
      });
    }
    return result;
  }

  /** All four tables of one institution's books, rows verbatim. */
  private async readBooks(
    connection: Kysely<Database>,
    books: Books
  ): Promise<LedgerRows> {
    const scoped = connection.withSchema(schemaOf(books));
    const [accounts, claims, payments, settings] = await Promise.all([
      scoped.selectFrom('accounts').selectAll().orderBy('id').execute(),
      scoped.selectFrom('claims').selectAll().orderBy('id').execute(),
      scoped.selectFrom('payments').selectAll().orderBy('id').execute(),
      scoped.selectFrom('settings').selectAll().orderBy('key').execute(),
    ]);
    return { accounts, claims, payments, settings };
  }

  private async dumpBooksTables(books: Books): Promise<DumpedTable[]> {
    const { accounts, claims, payments, settings } = await this.readBooks(
      this.dbConnection,
      books
    );
    return [
      {
        name: 'accounts',
        columns: ['id', 'number', 'person_id', 'owner', 'balance'],
        rows: accounts.map(row => [
          String(row.id),
          row.number,
          row.personId,
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

  /** Deletes every row of every institution and drops the banks' books. */
  async reset(): Promise<void> {
    await this.dbConnection.transaction().execute(trx => this.wipe(trx));
  }

  /** Drops every bank's schema and empties the central bank's tables. */
  private async wipe(trx: Kysely<Database>): Promise<void> {
    const banks = await trx
      .withSchema(CENTRAL_BANK_SCHEMA)
      .selectFrom('banks')
      .select('id')
      .execute();
    for (const bank of banks) {
      await sql`DROP SCHEMA IF EXISTS ${sql.id(bankSchemaName(bank.id))} CASCADE`.execute(
        trx
      );
    }
    await sql`TRUNCATE ${sql.id(CENTRAL_BANK_SCHEMA)}.banks, ${sql.id(CENTRAL_BANK_SCHEMA)}.accounts, ${sql.id(CENTRAL_BANK_SCHEMA)}.claims, ${sql.id(CENTRAL_BANK_SCHEMA)}.payments, ${sql.id(CENTRAL_BANK_SCHEMA)}.settings RESTART IDENTITY`.execute(
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
          .selectFrom('banks')
          .selectAll()
          .orderBy('id')
          .execute();
        const ledgers: StateSnapshot['ledgers'] = [
          {
            books: 'central-bank',
            rows: await this.readBooks(trx, 'central-bank'),
          },
        ];
        for (const bank of banks) {
          ledgers.push({
            books: bank.id,
            rows: await this.readBooks(trx, bank.id),
          });
        }
        return { banks, ledgers };
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
    const stored = await sql<{ data: StateSnapshot }>`
      SELECT data FROM public.state_snapshot WHERE id = 1
    `.execute(this.dbConnection);
    const snapshot = stored.rows[0]?.data;
    if (!snapshot) return false;
    // One transaction, because reads run concurrently and some write: a
    // missing rate key is written back as a default (policyRate,
    // interestRate), and between a wipe and the re-insert that default
    // would collide with the restored row. Atomic restore leaves
    // concurrent writers either before the wipe or after the commit.
    await this.dbConnection.transaction().execute(async trx => {
      await this.wipe(trx);
      if (snapshot.banks.length > 0) {
        await trx
          .withSchema(CENTRAL_BANK_SCHEMA)
          .insertInto('banks')
          .values(snapshot.banks)
          .execute();
      }
      for (const bank of snapshot.banks) {
        await ensureBooks(trx, bank.id);
      }
      for (const ledger of snapshot.ledgers) {
        await this.restoreBooks(trx, ledger.books, ledger.rows);
      }
      await this.restartSequence(trx, CENTRAL_BANK_SCHEMA, 'banks');
    });
    return true;
  }

  /** Re-inserts one institution's rows and re-arms its id sequences so
   *  later inserts continue past the restored ids. */
  private async restoreBooks(
    trx: Kysely<Database>,
    books: Books,
    rows: LedgerRows
  ): Promise<void> {
    const scoped = trx.withSchema(schemaOf(books));
    if (rows.accounts.length > 0) {
      await scoped.insertInto('accounts').values(rows.accounts).execute();
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
      await this.restartSequence(trx, schemaOf(books), table);
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
