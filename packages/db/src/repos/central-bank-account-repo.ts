// The accounts in the central bank's database: the banks' reserve
// accounts and the central bank's own account. Only institutions bank
// at the central bank — no persons — so nothing here speaks of personal
// ids: not this API, and not the table itself (it has no person_id
// column). An account is found by its holder's BIC, the identity the
// register issued it; `owner` is a display label and nothing more,
// exactly as a person's name is on a commercial account.

import type Big from 'big.js';
import type { Kysely } from 'kysely';

import type { CentralBankSchema, Database } from '../database-schema.ts';
import { CENTRAL_BANK_SCHEMA } from '../database-schema.ts';
import { Repo } from './repo.ts';

export interface CentralBankAccount {
  id: number;
  /** The holding institution's BIC — what identifies this account. */
  bic: string;
  /** The holding institution's display name — a bank's, or the central
   *  bank's own reserved label. A label: never look a row up by it. */
  owner: string;
  balance: Big;
}

export class CentralBankAccountRepo extends Repo {
  /** Bound to the central bank's schema by construction — this repo
   *  cannot be pointed anywhere else. */
  constructor(dbConnection: Kysely<Database>) {
    super(dbConnection, CENTRAL_BANK_SCHEMA);
  }

  /** The central bank's accounts table in its own shape — the one place
   *  the country's shared table layout differs. One physical
   *  connection, viewed through the narrower schema. */
  private get table(): Kysely<CentralBankSchema> {
    return this.dbConnection.withSchema(
      CENTRAL_BANK_SCHEMA
    ) as unknown as Kysely<CentralBankSchema>;
  }

  /** Opens an account in the central bank's database — a bank's reserve
   *  account, or the central bank's own. */
  async create({
    owner,
    bic,
  }: {
    owner: string;
    bic: string;
  }): Promise<CentralBankAccount> {
    const row = await this.table
      .insertInto('accounts')
      .values({ owner, bic, balance: '0' })
      .returningAll()
      .executeTakeFirstOrThrow();
    return { ...row, balance: this.toMajor(row.balance) };
  }

  async getByBic({
    bic,
  }: {
    bic: string;
  }): Promise<CentralBankAccount | undefined> {
    const row = await this.table
      .selectFrom('accounts')
      .selectAll()
      .where('bic', '=', bic)
      .executeTakeFirst();
    return row && { ...row, balance: this.toMajor(row.balance) };
  }

  async list(): Promise<CentralBankAccount[]> {
    const rows = await this.table
      .selectFrom('accounts')
      .selectAll()
      .orderBy('id')
      .execute();
    return rows.map(row => ({ ...row, balance: this.toMajor(row.balance) }));
  }

  async setBalance({
    id,
    balance,
  }: {
    id: number;
    balance: Big;
  }): Promise<void> {
    await this.table
      .updateTable('accounts')
      .set({ balance: this.toMinor(balance) })
      .where('id', '=', id)
      .execute();
  }
}
