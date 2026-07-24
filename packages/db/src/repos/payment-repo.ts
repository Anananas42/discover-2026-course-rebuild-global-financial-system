// A bank's record of the interbank payments it sent — one row per
// payment order, created 'accepted' and advanced by status as the
// payment settles and completes. The row is the sending bank's own
// evidence of what it set in motion; a crash can strand the system
// mid-payment, and this table is what explains the difference.

import type Big from 'big.js';

import type { PaymentStatus } from '../database-schema.ts';
import { Repo } from './repo.ts';

export interface Payment {
  id: number;
  /** The debited account's internal id, in the sending bank's database. */
  fromAccountId: number;
  toBankId: number;
  toAccountNumber: string;
  amount: Big;
  status: PaymentStatus;
}

export class PaymentRepo extends Repo {
  async create({
    fromAccountId,
    toBankId,
    toAccountNumber,
    amount,
  }: {
    fromAccountId: number;
    toBankId: number;
    toAccountNumber: string;
    amount: Big;
  }): Promise<Payment> {
    const row = await this.scoped()
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
    id,
    status,
  }: {
    id: number;
    status: PaymentStatus;
  }): Promise<void> {
    await this.scoped()
      .updateTable('payments')
      .set({ status })
      .where('id', '=', id)
      .execute();
  }

  async list(): Promise<Payment[]> {
    const rows = await this.scoped()
      .selectFrom('payments')
      .selectAll()
      .orderBy('id')
      .execute();
    return rows.map(row => ({ ...row, amount: this.toMajor(row.amount) }));
  }
}
