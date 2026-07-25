import Big from 'big.js';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';

import { AccountExistsError, NegativeAmountError } from './warmup-errors.ts';
import type {
  StandInDb,
  StandInRegister,
  StandInRepo,
} from './warmup-exercises.ts';
import {
  countLicensedBanks,
  readBalance,
  recordNewAccount,
  recordTransfer,
  relayStatus,
  requireNonNegativeAmount,
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

describe('task 0.3: relaying the status', () => {
  it("relays headquarters' status from inside the Effect frame", async () => {
    const status = await Effect.runPromise(relayStatus());
    expect(status).toBe('All stations report ready.');
  });
});

describe('task 0.4: refusing a negative amount', () => {
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

/** A stand-in repository with one balance and one count to answer, both
 *  arriving as Promises the way a real repository's do. */
function standInRepo(): StandInRepo {
  return {
    ownAccountBalance: async () => new Big('120'),
    licensedBankCount: async () => 3,
  };
}

describe('task 0.5: reading a balance', () => {
  it("hands back the repository's answer untouched", async () => {
    const balance = await readBalance(standInRepo());
    expect(balance.eq('120')).toBe(true);
  });
});

describe('task 0.6: waiting for the register count', () => {
  it('returns the count itself, not a Promise of one', async () => {
    const count = await Effect.runPromise(countLicensedBanks(standInRepo()));
    expect(count).toBe(3);
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
  const write = (
    into: Map<string, Big>,
    { account, balance }: { account: string; balance: Big }
  ): void => {
    if (account === failingAccount) {
      throw new Error('The power died mid-write.');
    }
    into.set(account, balance);
  };
  const db: StandInDb = {
    // Straight onto the balances: this write is done the moment it is
    // made, whether or not a transaction happens to be open around it.
    setBalance: async input => write(balances, input),
    async transaction(fn) {
      // What the block writes through `tx` is held aside until it ends.
      const staged = new Map<string, Big>();
      const result = await fn({
        setBalance: async input => write(staged, input),
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
    expect(
      balances.get('generators')?.eq('100'),
      'The first balance was written but the second was not, and the first stayed written. A write made on db lands on its own even inside a transaction block — only writes made through the tx that db.transaction hands you are taken back together.'
    ).toBe(true);
    expect(balances.has('antennas')).toBe(false);
  });
});

/** A register already holding the given names, which opens what it is
 *  told to and remembers whether it was asked to. */
function standInRegister(taken: string[]): {
  register: StandInRegister;
  opened: string[];
} {
  const opened: string[] = [];
  const register: StandInRegister = {
    isNameTaken: async ({ name }) => taken.includes(name),
    open: async ({ name }) => {
      opened.push(name);
      return { name, balance: new Big('0') };
    },
  };
  return { register, opened };
}

describe('task 0.8: opening an account unless the name is taken', () => {
  it('opens the account and returns it when the name is free', async () => {
    const { register, opened } = standInRegister([]);
    const account = await Effect.runPromise(
      recordNewAccount(register, { name: 'antennas' })
    );
    expect(account.name).toBe('antennas');
    expect(opened).toEqual(['antennas']);
  });

  it('refuses a name the register already holds', async () => {
    const { register } = standInRegister(['antennas']);
    // Which of the two ways the method ended matters as much as what it
    // ended with — handing the error back as an ordinary answer is not
    // refusing. Effect.match reports the way and the value separately,
    // and never rejects, so the assertions below always run and can say
    // what went wrong.
    const outcome = await Effect.runPromise(
      Effect.match(recordNewAccount(register, { name: 'antennas' }), {
        onFailure: (error): { refused: boolean; value: unknown } => ({
          refused: true,
          value: error,
        }),
        onSuccess: (account): { refused: boolean; value: unknown } => ({
          refused: false,
          value: account,
        }),
      })
    );
    expect(
      outcome.refused,
      "recordNewAccount ended by returning a value, not by refusing. What refuses is the yield*: yield* Effect.fail(error) hands the error back as the method's failure. An error built and returned any other way — a plain return, or a return from inside the function handed to Effect.promise, where yield* cannot be written — is just the answer the caller receives."
    ).toBe(true);
    expect(outcome.value).toBeInstanceOf(AccountExistsError);
  });

  it('does not open an account for a name it refused', async () => {
    const { register, opened } = standInRegister(['antennas']);
    await Effect.runPromise(
      Effect.ignore(recordNewAccount(register, { name: 'antennas' }))
    );
    expect(opened).toEqual([]);
  });
});
