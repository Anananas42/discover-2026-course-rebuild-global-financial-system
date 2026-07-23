// Loans owed to one institution. The borrower is an id, never a label:
// a bank id in the central bank's database, a personal id in a bank's —
// views resolve display names. Closed claims (repaid, written-off) stay
// in the table as history but leave the live set every read here
// returns — a real institution archives, it does not delete.

import type Big from 'big.js';

import type { ClaimStatus } from '../database-schema.ts';
import { Repo } from './repo.ts';

export interface Claim {
  id: number;
  borrower: string;
  amount: Big;
  status: ClaimStatus;
}

export class ClaimRepo extends Repo {
  async create({
    borrower,
    amount,
  }: {
    borrower: string;
    amount: Big;
  }): Promise<Claim> {
    const row = await this.scoped()
      .insertInto('claims')
      .values({ borrower, amount: this.toMinor(amount) })
      .returningAll()
      .executeTakeFirstOrThrow();
    return { ...row, amount: this.toMajor(row.amount) };
  }

  /** The borrower's live claim — the one still owed. A borrower who paid
   *  off and borrows again gets a fresh claim, not the closed one. */
  async getByBorrower({
    borrower,
  }: {
    borrower: string;
  }): Promise<Claim | undefined> {
    const row = await this.scoped()
      .selectFrom('claims')
      .selectAll()
      .where('borrower', '=', borrower)
      .where('status', '=', 'active')
      .executeTakeFirst();
    return row && { ...row, amount: this.toMajor(row.amount) };
  }

  /** The live claims — what is still owed. Closed claims are history,
   *  visible only in the raw dump, never on a balance sheet. */
  async list(): Promise<Claim[]> {
    const rows = await this.scoped()
      .selectFrom('claims')
      .selectAll()
      .where('status', '=', 'active')
      .orderBy('id')
      .execute();
    return rows.map(row => ({ ...row, amount: this.toMajor(row.amount) }));
  }

  async setAmount({ id, amount }: { id: number; amount: Big }): Promise<void> {
    await this.scoped()
      .updateTable('claims')
      .set({ amount: this.toMinor(amount) })
      .where('id', '=', id)
      .execute();
  }

  /** Close a claim by setting its status — 'repaid' or 'written-off'.
   *  The row stays as history; it just leaves the live set. */
  async setStatus({
    id,
    status,
  }: {
    id: number;
    status: ClaimStatus;
  }): Promise<void> {
    await this.scoped()
      .updateTable('claims')
      .set({ status })
      .where('id', '=', id)
      .execute();
  }
}
