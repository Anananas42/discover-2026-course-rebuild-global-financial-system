import Big from 'big.js';
import { Effect } from 'effect';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { Db } from '@banks/db/bank-db.ts';
import { connect } from '@banks/db/database.ts';

import {
  DuplicateBankNameError,
  InsufficientCentralBankFundsError,
  InsufficientReservesError,
  InvalidAmountError,
  InvalidBankNameError,
  InvalidRateError,
  NoDebtToWriteOffError,
  RepaymentExceedsDebtError,
  SameBankError,
  UnknownBankError,
} from './bank-errors.ts';
import { CentralBank, parseAmount } from './central-bank-service.ts';
import { CURRENCY } from './currency.ts';

let db: Db;
let centralBank: CentralBank;

beforeAll(async () => {
  db = await connect();
  centralBank = new CentralBank(db);
});

beforeEach(async () => {
  await db.reset();
});

afterAll(async () => {
  await db.destroy();
});

describe('task 1.1: opening a new bank', () => {
  it('registers a bank and opens its reserve account', async () => {
    const bank = await Effect.runPromise(
      centralBank.registerBank({ name: 'First Bank' })
    );
    expect(bank.name).toBe('First Bank');
    const books = await Effect.runPromise(centralBank.balanceSheet());
    expect(books.reserveAccounts).toHaveLength(1);
    expect(books.reserveAccounts[0]?.owner).toBe('First Bank');
    expect(books.reserveAccounts[0]?.balance.eq(0)).toBe(true);
  });

  it("opens the bank's own account in the bank's books", async () => {
    const bank = await Effect.runPromise(
      centralBank.registerBank({ name: 'First Bank' })
    );
    const accounts = await db.accounts.list({ books: bank.id });
    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.owner).toBe('First Bank');
    // The empty personal id marks an institution's own account.
    expect(accounts[0]?.personId).toBe('');
    expect(accounts[0]?.balance.eq(0)).toBe(true);
  });

  it('rejects a duplicate bank name', async () => {
    await Effect.runPromise(centralBank.registerBank({ name: 'First Bank' }));
    const error = await Effect.runPromise(
      Effect.flip(centralBank.registerBank({ name: 'First Bank' }))
    );
    expect(error).toBeInstanceOf(DuplicateBankNameError);
  });

  it('rejects "Central Bank" as a name, in any casing', async () => {
    const error = await Effect.runPromise(
      Effect.flip(centralBank.registerBank({ name: 'central BANK' }))
    );
    expect(error).toBeInstanceOf(InvalidBankNameError);
  });
});

describe('task 2.1: lending to a bank', () => {
  it('the bank receives the reserves and owes the amount plus interest', async () => {
    const bank = await Effect.runPromise(
      centralBank.registerBank({ name: 'First Bank' })
    );
    const debt = await Effect.runPromise(
      centralBank.lendToBank({ bankId: bank.id, amount: new Big('4000') })
    );
    // 5% policy rate: the bank receives 4000 of reserves and owes 4200;
    // the 200 is the central bank's income — its equity.
    expect(debt.eq('4200')).toBe(true);
    const books = await Effect.runPromise(centralBank.balanceSheet());
    expect(books.totalReserves.eq('4000')).toBe(true);
    expect(books.totalClaims.eq('4200')).toBe(true);
    expect(books.equity.eq('200')).toBe(true);
    expect(books.claims[0]?.borrower).toBe('First Bank');
  });

  it("the interest owed pushes the bank's own account below zero", async () => {
    const bank = await Effect.runPromise(
      centralBank.registerBank({ name: 'First Bank' })
    );
    await Effect.runPromise(
      centralBank.lendToBank({ bankId: bank.id, amount: new Big('4000') })
    );
    // The bank owes 200 more than it received — its own account goes
    // into the red until it earns income by lending on.
    const accounts = await db.accounts.list({ books: bank.id });
    expect(accounts[0]?.balance.eq('-200')).toBe(true);
  });

  it('rejects lending to an unknown bank', async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        centralBank.lendToBank({ bankId: 99, amount: new Big('100') })
      )
    );
    expect(error).toBeInstanceOf(UnknownBankError);
  });

  it('rejects a loan of zero', async () => {
    const bank = await Effect.runPromise(
      centralBank.registerBank({ name: 'First Bank' })
    );
    const error = await Effect.runPromise(
      Effect.flip(
        centralBank.lendToBank({ bankId: bank.id, amount: new Big('0') })
      )
    );
    expect(error).toBeInstanceOf(InvalidAmountError);
  });
});

describe('task 3.1: transferring reserves', () => {
  it('moves reserves between banks without changing the total', async () => {
    const first = await Effect.runPromise(
      centralBank.registerBank({ name: 'First Bank' })
    );
    const second = await Effect.runPromise(
      centralBank.registerBank({ name: 'Second Bank' })
    );
    await Effect.runPromise(
      centralBank.lendToBank({ bankId: first.id, amount: new Big('4000') })
    );
    await Effect.runPromise(
      centralBank.transferReserves({
        fromBankId: first.id,
        toBankId: second.id,
        amount: new Big('800'),
      })
    );
    const books = await Effect.runPromise(centralBank.balanceSheet());
    const byOwner = new Map(
      books.reserveAccounts.map(account => [account.owner, account.balance])
    );
    expect(byOwner.get('First Bank')?.eq('3200')).toBe(true);
    expect(byOwner.get('Second Bank')?.eq('800')).toBe(true);
    expect(books.totalReserves.eq('4000')).toBe(true);
  });

  it('rejects sending more reserves than the bank has', async () => {
    const first = await Effect.runPromise(
      centralBank.registerBank({ name: 'First Bank' })
    );
    const second = await Effect.runPromise(
      centralBank.registerBank({ name: 'Second Bank' })
    );
    await Effect.runPromise(
      centralBank.lendToBank({ bankId: first.id, amount: new Big('100') })
    );
    const error = await Effect.runPromise(
      Effect.flip(
        centralBank.transferReserves({
          fromBankId: first.id,
          toBankId: second.id,
          amount: new Big('101'),
        })
      )
    );
    expect(error).toBeInstanceOf(InsufficientReservesError);
    expect(error.message).toContain('100');
  });

  it('rejects a transfer from a bank to itself', async () => {
    const first = await Effect.runPromise(
      centralBank.registerBank({ name: 'First Bank' })
    );
    const error = await Effect.runPromise(
      Effect.flip(
        centralBank.transferReserves({
          fromBankId: first.id,
          toBankId: first.id,
          amount: new Big('1'),
        })
      )
    );
    expect(error).toBeInstanceOf(SameBankError);
  });
});

describe('task 2.2: receiving repayments', () => {
  it('a repayment returns reserves and shrinks the debt by the same amount', async () => {
    const bank = await Effect.runPromise(
      centralBank.registerBank({ name: 'First Bank' })
    );
    await Effect.runPromise(
      centralBank.lendToBank({ bankId: bank.id, amount: new Big('4000') })
    );
    const remaining = await Effect.runPromise(
      centralBank.receiveRepayment({ bankId: bank.id, amount: new Big('1500') })
    );
    // 4200 owed (4000 plus interest), 1500 repaid.
    expect(remaining.eq('2700')).toBe(true);
    const books = await Effect.runPromise(centralBank.balanceSheet());
    expect(books.totalReserves.eq('2500')).toBe(true);
    expect(books.totalClaims.eq('2700')).toBe(true);
  });

  it('rejects repaying more than is owed', async () => {
    const bank = await Effect.runPromise(
      centralBank.registerBank({ name: 'First Bank' })
    );
    await Effect.runPromise(
      centralBank.lendToBank({ bankId: bank.id, amount: new Big('100') })
    );
    const error = await Effect.runPromise(
      Effect.flip(
        centralBank.receiveRepayment({
          bankId: bank.id,
          amount: new Big('200'),
        })
      )
    );
    expect(error).toBeInstanceOf(RepaymentExceedsDebtError);
  });
});

describe('task 3.2: paying a bank', () => {
  it("adds to the bank's reserves, paid from the central bank's earnings", async () => {
    const bank = await Effect.runPromise(
      centralBank.registerBank({ name: 'First Bank' })
    );
    await Effect.runPromise(
      centralBank.lendToBank({ bankId: bank.id, amount: new Big('100') })
    );
    await Effect.runPromise(
      centralBank.payToBank({ bankId: bank.id, amount: new Big('3') })
    );
    const books = await Effect.runPromise(centralBank.balanceSheet());
    expect(books.reserveAccounts[0]?.balance.eq('103')).toBe(true);
    expect(books.equity.eq('2')).toBe(true);
    // The bank's own account: -5 of interest expense, +3 received.
    const accounts = await db.accounts.list({ books: bank.id });
    expect(accounts[0]?.balance.eq('-2')).toBe(true);
  });

  it('the interest owed can only be repaid after the central bank spends its earnings', async () => {
    const bank = await Effect.runPromise(
      centralBank.registerBank({ name: 'First Bank' })
    );
    await Effect.runPromise(
      centralBank.lendToBank({ bankId: bank.id, amount: new Big('100') })
    );
    // The bank received 100 of reserves but owes 105 — the missing 5
    // sits in the central bank's own account.
    const remaining = await Effect.runPromise(
      centralBank.receiveRepayment({ bankId: bank.id, amount: new Big('100') })
    );
    expect(remaining.eq('5')).toBe(true);
    const stuck = await Effect.runPromise(
      Effect.flip(
        centralBank.receiveRepayment({ bankId: bank.id, amount: new Big('5') })
      )
    );
    expect(stuck).toBeInstanceOf(InsufficientReservesError);
    // The central bank pays the bank (interest on reserves, services) —
    // its income returns to the system, and the claim can die.
    await Effect.runPromise(
      centralBank.payToBank({ bankId: bank.id, amount: new Big('5') })
    );
    const rest = await Effect.runPromise(
      centralBank.receiveRepayment({ bankId: bank.id, amount: new Big('5') })
    );
    expect(rest.eq(0)).toBe(true);
    const books = await Effect.runPromise(centralBank.balanceSheet());
    expect(books.claims).toHaveLength(0);
    expect(books.totalReserves.eq(0)).toBe(true);
    expect(books.equity.eq(0)).toBe(true);
  });

  it('rejects paying more than the central bank has earned', async () => {
    const bank = await Effect.runPromise(
      centralBank.registerBank({ name: 'First Bank' })
    );
    await Effect.runPromise(
      centralBank.lendToBank({ bankId: bank.id, amount: new Big('100') })
    );
    const error = await Effect.runPromise(
      Effect.flip(
        centralBank.payToBank({ bankId: bank.id, amount: new Big('6') })
      )
    );
    expect(error).toBeInstanceOf(InsufficientCentralBankFundsError);
  });

  it('rejects paying an unknown bank', async () => {
    const error = await Effect.runPromise(
      Effect.flip(centralBank.payToBank({ bankId: 99, amount: new Big('1') }))
    );
    expect(error).toBeInstanceOf(UnknownBankError);
  });
});

describe("task 2.3: writing off a bank's debt", () => {
  it('the central bank takes the loss and the bank keeps the reserves', async () => {
    const bank = await Effect.runPromise(
      centralBank.registerBank({ name: 'First Bank' })
    );
    await Effect.runPromise(
      centralBank.lendToBank({ bankId: bank.id, amount: new Big('100') })
    );
    const writtenOff = await Effect.runPromise(
      centralBank.writeOffClaim({ bankId: bank.id })
    );
    expect(writtenOff.eq('105')).toBe(true);
    const books = await Effect.runPromise(centralBank.balanceSheet());
    expect(books.claims).toHaveLength(0);
    // The reserves the loan created stay in circulation; the loss lands
    // on the central bank's own account — negative, and survivable only
    // here: a central bank cannot go bust in the currency it issues.
    expect(books.totalReserves.eq('100')).toBe(true);
    expect(books.equity.eq('-100')).toBe(true);
    // Forgiveness is the debtor's gain: the bank's liability vanished,
    // so its equity grew by the written-off amount (-5 + 105).
    const accounts = await db.accounts.list({ books: bank.id });
    expect(accounts[0]?.balance.eq('100')).toBe(true);
  });

  it('rejects writing off a bank that owes nothing', async () => {
    const bank = await Effect.runPromise(
      centralBank.registerBank({ name: 'First Bank' })
    );
    const error = await Effect.runPromise(
      Effect.flip(centralBank.writeOffClaim({ bankId: bank.id }))
    );
    expect(error).toBeInstanceOf(NoDebtToWriteOffError);
  });
});

describe('task 2.4: setting the central bank interest rate', () => {
  it('defaults to 5%', async () => {
    const rate = await Effect.runPromise(centralBank.policyRate());
    expect(rate.eq('0.05')).toBe(true);
  });

  it('a changed rate affects only new loans, not existing debts', async () => {
    const bank = await Effect.runPromise(
      centralBank.registerBank({ name: 'First Bank' })
    );
    await Effect.runPromise(
      centralBank.lendToBank({ bankId: bank.id, amount: new Big('100') })
    );
    const rate = await Effect.runPromise(
      centralBank.setPolicyRate({ percent: '10' })
    );
    expect(rate.eq('0.10')).toBe(true);
    // The first loan stays priced at 5%; the second costs 10%.
    const debt = await Effect.runPromise(
      centralBank.lendToBank({ bankId: bank.id, amount: new Big('100') })
    );
    expect(debt.eq('215')).toBe(true);
    const books = await Effect.runPromise(centralBank.balanceSheet());
    expect(books.equity.eq('15')).toBe(true);
  });

  it('can be zero, making borrowing free', async () => {
    const bank = await Effect.runPromise(
      centralBank.registerBank({ name: 'First Bank' })
    );
    await Effect.runPromise(centralBank.setPolicyRate({ percent: '0' }));
    const debt = await Effect.runPromise(
      centralBank.lendToBank({ bankId: bank.id, amount: new Big('100') })
    );
    expect(debt.eq('100')).toBe(true);
    const books = await Effect.runPromise(centralBank.balanceSheet());
    expect(books.equity.eq(0)).toBe(true);
  });

  it('a negative rate makes the bank owe back less than it borrowed', async () => {
    const bank = await Effect.runPromise(
      centralBank.registerBank({ name: 'First Bank' })
    );
    await Effect.runPromise(centralBank.setPolicyRate({ percent: '-1' }));
    const debt = await Effect.runPromise(
      centralBank.lendToBank({ bankId: bank.id, amount: new Big('100') })
    );
    expect(debt.eq('99')).toBe(true);
  });

  it('rejects rates like "abc", -6, 101, or 4.755', async () => {
    for (const raw of ['abc', '-6', '101', '4.755']) {
      const error = await Effect.runPromise(
        Effect.flip(centralBank.setPolicyRate({ percent: raw }))
      );
      expect(error).toBeInstanceOf(InvalidRateError);
    }
    // Nothing stuck: the rate is still the default.
    const rate = await Effect.runPromise(centralBank.policyRate());
    expect(rate.eq('0.05')).toBe(true);
  });
});

describe('the reserve requirement dial', () => {
  it('defaults to 10%', async () => {
    const ratio = await Effect.runPromise(centralBank.reserveRatio());
    expect(ratio.eq('0.10')).toBe(true);
  });

  it('can be changed, even down to zero', async () => {
    const czech = await Effect.runPromise(
      centralBank.setReserveRatio({ percent: '2' })
    );
    expect(czech.eq('0.02')).toBe(true);
    const none = await Effect.runPromise(
      centralBank.setReserveRatio({ percent: '0' })
    );
    expect(none.eq(0)).toBe(true);
    const stored = await Effect.runPromise(centralBank.reserveRatio());
    expect(stored.eq(0)).toBe(true);
  });

  it('rejects an invalid percentage', async () => {
    const error = await Effect.runPromise(
      Effect.flip(centralBank.setReserveRatio({ percent: '-1' }))
    );
    expect(error).toBeInstanceOf(InvalidRateError);
  });
});

describe('parsing amounts', () => {
  it('accepts a plain amount', async () => {
    const amount = await Effect.runPromise(parseAmount('1200'));
    expect(amount.eq('1200')).toBe(true);
  });

  it('rejects amounts like "abc", -5, 0, or one decimal place too many', async () => {
    // One decimal place more than the configured currency has.
    const overPrecise = `1.${'0'.repeat(CURRENCY.decimals)}5`;
    for (const raw of ['abc', '-5', '0', overPrecise]) {
      const error = await Effect.runPromise(Effect.flip(parseAmount(raw)));
      expect(error).toBeInstanceOf(InvalidAmountError);
    }
  });
});
