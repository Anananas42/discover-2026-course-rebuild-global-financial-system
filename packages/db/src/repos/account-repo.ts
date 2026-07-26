// Deposit and reserve accounts in one institution's database.

import type Big from 'big.js';

import { Repo } from './repo.ts';

export interface Account {
  id: number;
  /** The externally visible, randomly issued account number. */
  number: string;
  /** The holder's personal id; empty for institutions' own accounts. */
  personId: string;
  /** The holder's name as printed on the account — display text. Two
   *  accounts may carry the same one, and a holder can change theirs. */
  ownerName: string;
  balance: Big;
}

export class AccountRepo extends Repo {
  async create({
    ownerName,
    number,
    personId,
  }: {
    ownerName: string;
    number: string;
    personId: string;
  }): Promise<Account> {
    const row = await this.scoped()
      .insertInto('accounts')
      .values({ ownerName, number, personId, balance: '0' })
      .returningAll()
      .executeTakeFirstOrThrow();
    return { ...row, balance: this.toMajor(row.balance) };
  }

  async listByPersonId({ personId }: { personId: string }): Promise<Account[]> {
    const rows = await this.scoped()
      .selectFrom('accounts')
      .selectAll()
      .where('personId', '=', personId)
      .orderBy('id')
      .execute();
    return rows.map(row => ({ ...row, balance: this.toMajor(row.balance) }));
  }

  async getByNumber({
    number,
  }: {
    number: string;
  }): Promise<Account | undefined> {
    const row = await this.scoped()
      .selectFrom('accounts')
      .selectAll()
      .where('number', '=', number)
      .executeTakeFirst();
    return row && { ...row, balance: this.toMajor(row.balance) };
  }

  async get({ id }: { id: number }): Promise<Account | undefined> {
    const row = await this.scoped()
      .selectFrom('accounts')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row && { ...row, balance: this.toMajor(row.balance) };
  }

  async list(): Promise<Account[]> {
    const rows = await this.scoped()
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
    await this.scoped()
      .updateTable('accounts')
      .set({ balance: this.toMinor(balance) })
      .where('id', '=', id)
      .execute();
  }

  async setOwnerName({
    id,
    ownerName,
  }: {
    id: number;
    ownerName: string;
  }): Promise<void> {
    await this.scoped()
      .updateTable('accounts')
      .set({ ownerName })
      .where('id', '=', id)
      .execute();
  }
}
