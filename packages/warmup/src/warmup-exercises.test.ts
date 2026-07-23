import Big from 'big.js';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';

import { NegativeAmountError } from './warmup-errors.ts';
import type { StandInDb } from './warmup-exercises.ts';
import {
  requireNonNegativeAmount,
  readBalance,
  readInstructions,
  recordTransfer,
  relayStatus,
  statusReport,
  totalOwed,
} from './warmup-exercises.ts';

describe('task 0.1: sending the status report', () => {
  it("reports 'ready'", () => {
    expect(statusReport()).toBe('ready');
  });
});

describe('task 0.2: adding two amounts', () => {
  it('adds the interest to the amount', () => {
    expect(totalOwed(new Big('100'), new Big('5')).eq('105')).toBe(true);
  });

  it('handles amounts far beyond what plain numbers could', () => {
    const amount = new Big('90000000000000000');
    const interest = new Big('7');
    expect(totalOwed(amount, interest).eq('90000000000000007')).toBe(true);
  });
});

describe('task 0.3: reading a balance', () => {
  it("hands back the repository's answer untouched", async () => {
    const balance = await readBalance({
      ownAccountBalance: async () => new Big('120'),
    });
    expect(balance.eq('120')).toBe(true);
  });
});

describe('task 0.4: relaying the status', () => {
  it("relays headquarters' status from inside the Effect frame", async () => {
    const status = await Effect.runPromise(relayStatus());
    expect(status).toBe('All stations report ready.');
  });
});

describe('task 0.5: waiting for the instructions', () => {
  it('returns the instructions from inside the Effect frame', async () => {
    const instructions = await Effect.runPromise(
      readInstructions({
        instructions: async () => 'Rebuild the central bank first.',
      })
    );
    expect(instructions).toBe('Rebuild the central bank first.');
  });
});

describe('task 0.6: refusing a negative amount', () => {
  it('returns a valid amount unchanged', async () => {
    const amount = await Effect.runPromise(
      requireNonNegativeAmount(new Big('250'))
    );
    expect(amount.eq('250')).toBe(true);
  });

  it('zero is not negative', async () => {
    const amount = await Effect.runPromise(
      requireNonNegativeAmount(new Big('0'))
    );
    expect(amount.eq(0)).toBe(true);
  });

  it('refuses a negative amount with NegativeAmountError', async () => {
    const error = await Effect.runPromise(
      Effect.flip(requireNonNegativeAmount(new Big('-1')))
    );
    expect(error).toBeInstanceOf(NegativeAmountError);
    expect(error.message).toContain('-1');
  });
});

/** A stand-in database: 100 on the generators account, and a
 *  transaction that commits its writes together or — when a write
 *  throws — not at all. Writing to `failingAccount` cuts the power.
 *  Committing takes one tick, like a real database over the wire, so
 *  code that does not wait for the transaction reports done while the
 *  balances are still unchanged. */
function standInDb(failingAccount?: string) {
  const balances = new Map<string, Big>([['generators', new Big('100')]]);
  const db: StandInDb = {
    async transaction(fn) {
      const staged = new Map(balances);
      const result = await fn({
        setBalance: async ({ account, balance }) => {
          if (account === failingAccount) {
            throw new Error('The power died mid-write.');
          }
          staged.set(account, balance);
        },
      });
      await new Promise<void>(resolve => setTimeout(resolve));
      // Only a block that ran to the end lands in the balances.
      for (const [account, balance] of staged) balances.set(account, balance);
      return result;
    },
  };
  return { db, balances };
}

const generators = { name: 'generators', balance: new Big('100') };
const antennas = { name: 'antennas', balance: new Big('0') };

describe('task 0.7: moving money in one transaction', () => {
  it('moves the amount from one account to the other', async () => {
    const { db, balances } = standInDb();
    await Effect.runPromise(
      recordTransfer(db, {
        from: generators,
        to: antennas,
        amount: new Big('40'),
      })
    );
    expect(balances.get('generators')?.eq('60')).toBe(true);
    expect(balances.get('antennas')?.eq('40')).toBe(true);
  });

  it('waits for the transaction to commit before reporting done', async () => {
    const { db, balances } = standInDb();
    await Effect.runPromise(
      recordTransfer(db, {
        from: generators,
        to: antennas,
        amount: new Big('40'),
      })
    );
    expect(
      balances.get('antennas')?.eq('40'),
      'recordTransfer reported done while the transaction was still running — wait for it: yield* Effect.promise(() => db.transaction(...))'
    ).toBe(true);
  });

  it('a power cut between the two writes leaves both accounts untouched', async () => {
    const { db, balances } = standInDb('antennas');
    await expect(
      Effect.runPromise(
        recordTransfer(db, {
          from: generators,
          to: antennas,
          amount: new Big('40'),
        })
      )
    ).rejects.toThrow();
    expect(balances.get('generators')?.eq('100')).toBe(true);
    expect(balances.has('antennas')).toBe(false);
  });
});
