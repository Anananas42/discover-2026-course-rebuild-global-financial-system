import Big from 'big.js';
import { Effect } from 'effect';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  InsufficientReservesError,
  SameBankError,
  InvalidRateError,
  NoDebtToWriteOffError,
  RepaymentExceedsDebtError,
} from '@banks/central-bank/bank-errors.ts';
import { CentralBank } from '@banks/central-bank/central-bank-service.ts';
import { randomAccountNumber } from '@banks/db/account-number.ts';
import type { Account, Bank, Db } from '@banks/db/bank-db.ts';
import { connect } from '@banks/db/database.ts';
import { randomPersonalId } from '@banks/db/person-id.ts';

import {
  ForeignIbanError,
  InsufficientFundsError,
  NotAccountOwnerError,
  ReserveRequirementError,
  SameAccountError,
  UnknownAccountError,
  UnknownPersonError,
} from './commercial-bank-errors.ts';
import { CommercialBanks } from './commercial-bank-service.ts';
import { bicFor, ibanFor } from './iban.ts';

let db: Db;
let centralBank: CentralBank;
let banks: CommercialBanks;

beforeAll(async () => {
  db = await connect();
  centralBank = new CentralBank(db);
  banks = new CommercialBanks(db, centralBank);
});

beforeEach(async () => {
  await db.reset();
});

afterAll(async () => {
  await db.destroy();
});

/** A registered bank with the given reserves at the central bank. */
async function bankWithReserves(name: string, reserves: string): Promise<Bank> {
  const bank = await Effect.runPromise(centralBank.registerBank({ name }));
  if (reserves !== '0') {
    await Effect.runPromise(
      centralBank.lendToBank({ bankId: bank.id, amount: new Big(reserves) })
    );
  }
  return bank;
}

/** An account with a balance, planted straight into a bank's books.
 *  The payment tasks (stage 4) come before people and their loans
 *  exist, so their tests plant the rows that money moves between. */
async function plantedAccount(
  bankId: number,
  owner: string,
  balance: string
): Promise<Account> {
  const account = await db.accounts.create({
    books: bankId,
    owner,
    number: randomAccountNumber(),
    personId: randomPersonalId(),
  });
  await db.accounts.setBalance({
    books: bankId,
    id: account.id,
    balance: new Big(balance),
  });
  return { ...account, balance: new Big(balance) };
}

describe('task 5.1: becoming a client', () => {
  it('issues a personal id and a random account number', async () => {
    const bank = await bankWithReserves('First Bank', '0');
    const account = await Effect.runPromise(
      banks.becomeClient({ bankId: bank.id, name: 'Alice' })
    );
    expect(account.owner).toBe('Alice');
    expect(account.personId).toMatch(/^\d{6}\/\d{4}$/);
    expect(account.number).toMatch(/^\d{10}$/);
    expect(account.balance.eq(0)).toBe(true);
  });

  it('two clients with the same name are two different people', async () => {
    const bank = await bankWithReserves('First Bank', '0');
    const first = await Effect.runPromise(
      banks.becomeClient({ bankId: bank.id, name: 'Alice' })
    );
    const second = await Effect.runPromise(
      banks.becomeClient({ bankId: bank.id, name: 'Alice' })
    );
    expect(first.personId).not.toBe(second.personId);
    expect(first.number).not.toBe(second.number);
  });
});

describe('task 5.2: opening further accounts', () => {
  it('opens another account for the same person, found by their personal id', async () => {
    const first = await bankWithReserves('First Bank', '0');
    const second = await bankWithReserves('Second Bank', '0');
    const alice = await Effect.runPromise(
      banks.becomeClient({ bankId: first.id, name: 'Alice' })
    );
    const more = await Effect.runPromise(
      banks.openAccount({ bankId: second.id, personId: alice.personId })
    );
    expect(more.owner).toBe('Alice');
    expect(more.personId).toBe(alice.personId);
  });

  it('rejects an unknown personal id', async () => {
    const bank = await bankWithReserves('First Bank', '0');
    const error = await Effect.runPromise(
      Effect.flip(
        banks.openAccount({ bankId: bank.id, personId: '000000/0000' })
      )
    );
    expect(error).toBeInstanceOf(UnknownPersonError);
  });
});

describe('task 7.1: lending to clients', () => {
  it('the client receives the money and owes the amount plus interest', async () => {
    const bank = await bankWithReserves('First Bank', '200');
    const account = await Effect.runPromise(
      banks.becomeClient({ bankId: bank.id, name: 'Alice' })
    );
    const debt = await Effect.runPromise(
      banks.lendToClient({
        bankId: bank.id,
        accountId: account.id,
        amount: new Big('1500'),
      })
    );
    // 10% interest: Alice receives 1500 and owes 1650; the 150 is the
    // bank's income, credited to its own account (equity) — on top of
    // the -10 policy-rate expense from borrowing its 200 of reserves.
    expect(debt.eq('1650')).toBe(true);
    const books = await Effect.runPromise(
      banks.balanceSheet({ bankId: bank.id })
    );
    expect(books.totalDeposits.eq('1500')).toBe(true);
    expect(books.totalLoans.eq('1650')).toBe(true);
    expect(books.equity.eq('140')).toBe(true);
  });

  it('rejects a loan the bank does not hold enough reserves for', async () => {
    // Reserves must stay at least 10% of client deposits: 100 in
    // reserves supports at most 1000 of deposits.
    const bank = await bankWithReserves('First Bank', '100');
    const account = await Effect.runPromise(
      banks.becomeClient({ bankId: bank.id, name: 'Alice' })
    );
    const error = await Effect.runPromise(
      Effect.flip(
        banks.lendToClient({
          bankId: bank.id,
          accountId: account.id,
          amount: new Big('1001'),
        })
      )
    );
    expect(error).toBeInstanceOf(ReserveRequirementError);
    const books = await Effect.runPromise(
      banks.balanceSheet({ bankId: bank.id })
    );
    expect(books.totalDeposits.eq(0)).toBe(true);
    expect(books.loans).toHaveLength(0);
    // Untouched by the failed loan: only the policy-rate expense of
    // borrowing the 100 of reserves is on the books.
    expect(books.equity.eq('-5')).toBe(true);
  });

  it('when two clients share a name, only the borrower ends up in debt', async () => {
    const bank = await bankWithReserves('First Bank', '100');
    const alice1 = await Effect.runPromise(
      banks.becomeClient({ bankId: bank.id, name: 'Alice' })
    );
    const alice2 = await Effect.runPromise(
      banks.becomeClient({ bankId: bank.id, name: 'Alice' })
    );
    await Effect.runPromise(
      banks.lendToClient({
        bankId: bank.id,
        accountId: alice1.id,
        amount: new Big('700'),
      })
    );
    const clients = await Effect.runPromise(banks.listClients());
    const debtor = clients.find(c => c.personId === alice1.personId);
    const other = clients.find(c => c.personId === alice2.personId);
    expect(debtor?.debt.eq('770')).toBe(true);
    expect(other?.debt.eq(0)).toBe(true);
  });

  it('rejects lending to an unknown account', async () => {
    const bank = await bankWithReserves('First Bank', '0');
    const error = await Effect.runPromise(
      Effect.flip(
        banks.lendToClient({
          bankId: bank.id,
          accountId: 99,
          amount: new Big('100'),
        })
      )
    );
    expect(error).toBeInstanceOf(UnknownAccountError);
  });

  it("refuses to lend to the bank's own account", async () => {
    const bank = await bankWithReserves('First Bank', '100');
    const books = await Effect.runPromise(
      banks.balanceSheet({ bankId: bank.id })
    );
    const error = await Effect.runPromise(
      Effect.flip(
        banks.lendToClient({
          bankId: bank.id,
          accountId: books.ownAccount.id,
          amount: new Big('100'),
        })
      )
    );
    expect(error).toBeInstanceOf(UnknownAccountError);
  });
});

describe('task 4.2: receiving a payment', () => {
  it('credits the account the message addresses by IBAN', async () => {
    const first = await bankWithReserves('First Bank', '0');
    const second = await bankWithReserves('Second Bank', '0');
    const alice = await plantedAccount(second.id, 'Alice', '100');
    const credited = await Effect.runPromise(
      banks.receivePayment({
        fromBic: bicFor(first.id),
        fromIban: ibanFor(first.id, '9999999999'),
        toBic: bicFor(second.id),
        toIban: ibanFor(second.id, alice.number),
        amount: new Big('250'),
      })
    );
    expect(credited.owner).toBe('Alice');
    expect(credited.balance.eq('350')).toBe(true);
    const books = await Effect.runPromise(
      banks.balanceSheet({ bankId: second.id })
    );
    expect(books.totalDeposits.eq('350')).toBe(true);
  });

  it('rejects a message from the bank to itself', async () => {
    const first = await bankWithReserves('First Bank', '0');
    const alice = await plantedAccount(first.id, 'Alice', '100');
    const error = await Effect.runPromise(
      Effect.flip(
        banks.receivePayment({
          fromBic: bicFor(first.id),
          fromIban: ibanFor(first.id, '9999999999'),
          toBic: bicFor(first.id),
          toIban: ibanFor(first.id, alice.number),
          amount: new Big('1'),
        })
      )
    );
    expect(error).toBeInstanceOf(SameBankError);
  });

  it('rejects a message for an account number nobody holds', async () => {
    const first = await bankWithReserves('First Bank', '0');
    const second = await bankWithReserves('Second Bank', '0');
    const error = await Effect.runPromise(
      Effect.flip(
        banks.receivePayment({
          fromBic: bicFor(first.id),
          fromIban: ibanFor(first.id, '9999999999'),
          toBic: bicFor(second.id),
          toIban: ibanFor(second.id, '0000000000'),
          amount: new Big('1'),
        })
      )
    );
    expect(error).toBeInstanceOf(UnknownAccountError);
  });
});

describe('task 4.1: transferring within a bank', () => {
  it('moves money between two accounts at the same bank without touching reserves', async () => {
    const bank = await bankWithReserves('First Bank', '100');
    const alice = await plantedAccount(bank.id, 'Alice', '1000');
    const bob = await plantedAccount(bank.id, 'Bob', '0');
    const receipt = await Effect.runPromise(
      banks.transfer({
        fromBankId: bank.id,
        fromAccountId: alice.id,
        toBankId: bank.id,
        toAccountNumber: bob.number,
        amount: new Big('300'),
      })
    );
    expect(receipt.kind).toBe('internal');
    expect(receipt.recipient).toBe('Bob');
    const books = await Effect.runPromise(
      banks.balanceSheet({ bankId: bank.id })
    );
    const byOwner = new Map(
      books.accounts.map(account => [account.owner, account.balance])
    );
    expect(byOwner.get('Alice')?.eq('700')).toBe(true);
    expect(byOwner.get('Bob')?.eq('300')).toBe(true);
    const central = await Effect.runPromise(centralBank.balanceSheet());
    expect(central.totalReserves.eq('100')).toBe(true);
  });
});

describe('task 4.3: transferring between banks', () => {
  it('a transfer to another bank moves reserves along with it', async () => {
    const first = await bankWithReserves('First Bank', '4000');
    const second = await bankWithReserves('Second Bank', '4000');
    const alice = await plantedAccount(first.id, 'Alice', '1500');
    const carol = await plantedAccount(second.id, 'Carol', '0');
    const receipt = await Effect.runPromise(
      banks.transfer({
        fromBankId: first.id,
        fromAccountId: alice.id,
        toBankId: second.id,
        toAccountNumber: carol.number,
        amount: new Big('800'),
      })
    );
    expect(receipt.kind).toBe('interbank');
    const central = await Effect.runPromise(centralBank.balanceSheet());
    const reserves = new Map(
      central.reserveAccounts.map(account => [account.owner, account.balance])
    );
    expect(reserves.get('First Bank')?.eq('3200')).toBe(true);
    expect(reserves.get('Second Bank')?.eq('4800')).toBe(true);
    const firstBooks = await Effect.runPromise(
      banks.balanceSheet({ bankId: first.id })
    );
    const secondBooks = await Effect.runPromise(
      banks.balanceSheet({ bankId: second.id })
    );
    expect(firstBooks.totalDeposits.eq('700')).toBe(true);
    expect(secondBooks.totalDeposits.eq('800')).toBe(true);
  });

  it("an interbank payment leaves a completed payment row in the sender's database", async () => {
    const first = await bankWithReserves('First Bank', '1000');
    const second = await bankWithReserves('Second Bank', '0');
    const alice = await plantedAccount(first.id, 'Alice', '500');
    const carol = await plantedAccount(second.id, 'Carol', '0');
    await Effect.runPromise(
      banks.transfer({
        fromBankId: first.id,
        fromAccountId: alice.id,
        toBankId: second.id,
        toAccountNumber: carol.number,
        amount: new Big('300'),
      })
    );
    const payments = await db.payments.list({ books: first.id });
    expect(payments).toHaveLength(1);
    expect(payments[0]?.amount.eq('300')).toBe(true);
    expect(payments[0]?.toAccountNumber).toBe(carol.number);
    expect(payments[0]?.status).toBe('completed');
    // The receiving bank sent no payment — its record stays empty.
    expect(await db.payments.list({ books: second.id })).toHaveLength(0);
  });
});

describe('the transfer engine', () => {
  it('a transfer without enough reserves fails and changes nothing', async () => {
    const first = await bankWithReserves('First Bank', '100');
    const second = await bankWithReserves('Second Bank', '0');
    const alice = await plantedAccount(first.id, 'Alice', '1000');
    const carol = await plantedAccount(second.id, 'Carol', '0');
    const error = await Effect.runPromise(
      Effect.flip(
        banks.transfer({
          fromBankId: first.id,
          fromAccountId: alice.id,
          toBankId: second.id,
          toAccountNumber: carol.number,
          amount: new Big('500'),
        })
      )
    );
    expect(error).toBeInstanceOf(InsufficientReservesError);
    const books = await Effect.runPromise(
      banks.balanceSheet({ bankId: first.id })
    );
    expect(books.accounts[0]?.balance.eq('1000')).toBe(true);
  });

  it('rejects sending more money than the account holds', async () => {
    const first = await bankWithReserves('First Bank', '4000');
    const second = await bankWithReserves('Second Bank', '0');
    const alice = await plantedAccount(first.id, 'Alice', '0');
    const carol = await plantedAccount(second.id, 'Carol', '0');
    const error = await Effect.runPromise(
      Effect.flip(
        banks.transfer({
          fromBankId: first.id,
          fromAccountId: alice.id,
          toBankId: second.id,
          toAccountNumber: carol.number,
          amount: new Big('1'),
        })
      )
    );
    expect(error).toBeInstanceOf(InsufficientFundsError);
  });

  it('rejects a transfer from an account to itself', async () => {
    const bank = await bankWithReserves('First Bank', '0');
    const alice = await plantedAccount(bank.id, 'Alice', '0');
    const error = await Effect.runPromise(
      Effect.flip(
        banks.transfer({
          fromBankId: bank.id,
          fromAccountId: alice.id,
          toBankId: bank.id,
          toAccountNumber: alice.number,
          amount: new Big('1'),
        })
      )
    );
    expect(error).toBeInstanceOf(SameAccountError);
  });
});

describe('task 6.1: sending money to an IBAN', () => {
  it('finds the recipient bank and account from the IBAN alone', async () => {
    const bank = await bankWithReserves('First Bank', '100');
    const alice = await Effect.runPromise(
      banks.becomeClient({ bankId: bank.id, name: 'Alice' })
    );
    const bob = await Effect.runPromise(
      banks.becomeClient({ bankId: bank.id, name: 'Bob' })
    );
    // A salary planted by hand — the walkthrough earns it through
    // "Pay from the bank's account" (task 4.2).
    await db.accounts.setBalance({
      books: bank.id,
      id: alice.id,
      balance: new Big('1000'),
    });
    const receipt = await Effect.runPromise(
      banks.sendMoney({
        personId: alice.personId,
        fromBankId: bank.id,
        fromAccountId: alice.id,
        toIban: ibanFor(bank.id, bob.number),
        amount: new Big('300'),
      })
    );
    expect(receipt.kind).toBe('internal');
    expect(receipt.recipient).toBe('Bob');
  });

  it('rejects an IBAN from another country', async () => {
    const first = await bankWithReserves('First Bank', '100');
    const alice = await Effect.runPromise(
      banks.becomeClient({ bankId: first.id, name: 'Alice' })
    );
    const error = await Effect.runPromise(
      Effect.flip(
        banks.sendMoney({
          personId: alice.personId,
          fromBankId: first.id,
          fromAccountId: alice.id,
          toIban: ibanFor(1, '1', 'QQ'),
          amount: new Big('1'),
        })
      )
    );
    expect(error).toBeInstanceOf(ForeignIbanError);
  });

  it('rejects sending from an account that is not yours', async () => {
    const bank = await bankWithReserves('First Bank', '0');
    const alice = await Effect.runPromise(
      banks.becomeClient({ bankId: bank.id, name: 'Alice' })
    );
    const bob = await Effect.runPromise(
      banks.becomeClient({ bankId: bank.id, name: 'Bob' })
    );
    // Ownership is checked before funds — no money needs to exist for
    // the order to be refused.
    const error = await Effect.runPromise(
      Effect.flip(
        banks.sendMoney({
          personId: alice.personId,
          fromBankId: bank.id,
          fromAccountId: bob.id,
          toIban: ibanFor(bank.id, alice.number),
          amount: new Big('1'),
        })
      )
    );
    expect(error).toBeInstanceOf(NotAccountOwnerError);
  });
});

describe('task 5.3: renaming a person', () => {
  it('renames the person everywhere they have an account, and nobody else', async () => {
    const first = await bankWithReserves('First Bank', '0');
    const second = await bankWithReserves('Second Bank', '0');
    const alice = await Effect.runPromise(
      banks.becomeClient({ bankId: first.id, name: 'Alice' })
    );
    await Effect.runPromise(
      banks.openAccount({ bankId: second.id, personId: alice.personId })
    );
    const otherAlice = await Effect.runPromise(
      banks.becomeClient({ bankId: first.id, name: 'Alice' })
    );
    // A salary planted by hand — money on the account without the loan
    // tasks that come later in the course.
    await db.accounts.setBalance({
      books: first.id,
      id: alice.id,
      balance: new Big('100'),
    });
    const renamed = await Effect.runPromise(
      banks.renamePerson({ personId: alice.personId, newName: 'Alicia' })
    );
    expect(renamed).toBe(2);
    const clients = await Effect.runPromise(banks.listClients());
    const hers = clients.filter(c => c.personId === alice.personId);
    const others = clients.filter(c => c.personId === otherAlice.personId);
    expect(hers.every(c => c.owner === 'Alicia')).toBe(true);
    expect(others.every(c => c.owner === 'Alice')).toBe(true);
    // The money survives the relabel — accounts are keyed by their ids.
    expect(hers.find(c => c.bankId === first.id)?.balance.eq('100')).toBe(true);
  });

  it('rejects renaming an unknown person', async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        banks.renamePerson({ personId: '000000/0000', newName: 'Nobody' })
      )
    );
    expect(error).toBeInstanceOf(UnknownPersonError);
  });

  it("rejects the empty personal id that marks banks' own accounts", async () => {
    await bankWithReserves('First Bank', '0');
    const error = await Effect.runPromise(
      Effect.flip(banks.renamePerson({ personId: '', newName: 'Not A Bank' }))
    );
    expect(error).toBeInstanceOf(UnknownPersonError);
  });
});

describe('task 8.1: repaying loans', () => {
  it('a repayment shrinks the debt and the account balance by the same amount', async () => {
    const bank = await bankWithReserves('First Bank', '100');
    const alice = await Effect.runPromise(
      banks.becomeClient({ bankId: bank.id, name: 'Alice' })
    );
    await Effect.runPromise(
      banks.lendToClient({
        bankId: bank.id,
        accountId: alice.id,
        amount: new Big('1000'),
      })
    );
    const remaining = await Effect.runPromise(
      banks.repayLoan({
        bankId: bank.id,
        accountId: alice.id,
        amount: new Big('400'),
      })
    );
    // She received 1000 and owes 1100 — 400 repaid leaves 700.
    expect(remaining.eq('700')).toBe(true);
    const books = await Effect.runPromise(
      banks.balanceSheet({ bankId: bank.id })
    );
    expect(books.totalDeposits.eq('600')).toBe(true);
    expect(books.totalLoans.eq('700')).toBe(true);
  });

  it('all money and all debts can reach zero once the interest is spent back', async () => {
    const bank = await bankWithReserves('First Bank', '100');
    const alice = await Effect.runPromise(
      banks.becomeClient({ bankId: bank.id, name: 'Alice' })
    );
    await Effect.runPromise(
      banks.lendToClient({
        bankId: bank.id,
        accountId: alice.id,
        amount: new Big('1000'),
      })
    );
    // Alice received 1000 but owes 1100, and the bank received 100 of
    // reserves but owes 105 — each layer's interest sits one level up.
    await Effect.runPromise(
      banks.repayLoan({
        bankId: bank.id,
        accountId: alice.id,
        amount: new Big('1000'),
      })
    );
    const stuck = await Effect.runPromise(
      Effect.flip(
        banks.repayLoan({
          bankId: bank.id,
          accountId: alice.id,
          amount: new Big('100'),
        })
      )
    );
    expect(stuck).toBeInstanceOf(InsufficientFundsError);
    // The bank's income is 100 of client interest minus its own 5 of
    // policy-rate expense — it can pay Alice at most 95.
    await Effect.runPromise(
      banks.payFromBankAccount({
        bankId: bank.id,
        toIban: ibanFor(bank.id, alice.number),
        amount: new Big('95'),
      })
    );
    // The last 5 exist only at the central bank; once it spends them to
    // the bank and the bank passes them on, every loan can die.
    await Effect.runPromise(
      centralBank.payToBank({ bankId: bank.id, amount: new Big('5') })
    );
    await Effect.runPromise(
      banks.payFromBankAccount({
        bankId: bank.id,
        toIban: ibanFor(bank.id, alice.number),
        amount: new Big('5'),
      })
    );
    const rest = await Effect.runPromise(
      banks.repayLoan({
        bankId: bank.id,
        accountId: alice.id,
        amount: new Big('100'),
      })
    );
    expect(rest.eq(0)).toBe(true);
    const remaining = await Effect.runPromise(
      centralBank.receiveRepayment({ bankId: bank.id, amount: new Big('105') })
    );
    expect(remaining.eq(0)).toBe(true);
    // All money destroyed, all debts gone, everywhere.
    const books = await Effect.runPromise(
      banks.balanceSheet({ bankId: bank.id })
    );
    expect(books.loans).toHaveLength(0);
    expect(books.totalDeposits.eq(0)).toBe(true);
    expect(books.equity.eq(0)).toBe(true);
    const central = await Effect.runPromise(centralBank.balanceSheet());
    expect(central.claims).toHaveLength(0);
    expect(central.totalReserves.eq(0)).toBe(true);
    expect(central.equity.eq(0)).toBe(true);
  });

  it('rejects repaying more than is owed', async () => {
    const bank = await bankWithReserves('First Bank', '10');
    const alice = await Effect.runPromise(
      banks.becomeClient({ bankId: bank.id, name: 'Alice' })
    );
    await Effect.runPromise(
      banks.lendToClient({
        bankId: bank.id,
        accountId: alice.id,
        amount: new Big('100'),
      })
    );
    const error = await Effect.runPromise(
      Effect.flip(
        banks.repayLoan({
          bankId: bank.id,
          accountId: alice.id,
          amount: new Big('200'),
        })
      )
    );
    expect(error).toBeInstanceOf(RepaymentExceedsDebtError);
  });
});

describe('task 7.2: writing off loans', () => {
  it('the bank takes the loss and the client keeps the money', async () => {
    const bank = await bankWithReserves('First Bank', '100');
    const alice = await Effect.runPromise(
      banks.becomeClient({ bankId: bank.id, name: 'Alice' })
    );
    await Effect.runPromise(
      banks.lendToClient({
        bankId: bank.id,
        accountId: alice.id,
        amount: new Big('1000'),
      })
    );
    const writtenOff = await Effect.runPromise(
      banks.writeOffLoan({ bankId: bank.id, personId: alice.personId })
    );
    expect(writtenOff.eq('1100')).toBe(true);
    const books = await Effect.runPromise(
      banks.balanceSheet({ bankId: bank.id })
    );
    expect(books.loans).toHaveLength(0);
    // The money the loan created stays in circulation; the loss lands on
    // the bank's own account, deep below zero — an insolvent bank, right
    // there on the balance sheet (95 of equity minus the 1100 loss).
    expect(books.totalDeposits.eq('1000')).toBe(true);
    expect(books.equity.eq('-1005')).toBe(true);
  });

  it('rejects writing off a client who owes nothing', async () => {
    const bank = await bankWithReserves('First Bank', '0');
    const alice = await Effect.runPromise(
      banks.becomeClient({ bankId: bank.id, name: 'Alice' })
    );
    const error = await Effect.runPromise(
      Effect.flip(
        banks.writeOffLoan({ bankId: bank.id, personId: alice.personId })
      )
    );
    expect(error).toBeInstanceOf(NoDebtToWriteOffError);
  });
});

describe('task 7.1: the reserve requirement limits lending', () => {
  it('after the ratio is raised, the same reserves support less lending', async () => {
    const bank = await bankWithReserves('First Bank', '100');
    const alice = await Effect.runPromise(
      banks.becomeClient({ bankId: bank.id, name: 'Alice' })
    );
    await Effect.runPromise(centralBank.setReserveRatio({ percent: '20' }));
    // At 20%, 100 of reserves supports only 500 of deposits.
    const error = await Effect.runPromise(
      Effect.flip(
        banks.lendToClient({
          bankId: bank.id,
          accountId: alice.id,
          amount: new Big('501'),
        })
      )
    );
    expect(error).toBeInstanceOf(ReserveRequirementError);
    const debt = await Effect.runPromise(
      banks.lendToClient({
        bankId: bank.id,
        accountId: alice.id,
        amount: new Big('500'),
      })
    );
    expect(debt.eq('550')).toBe(true);
  });

  it('at a ratio of zero, a bank can lend with no reserves at all', async () => {
    const bank = await bankWithReserves('First Bank', '0');
    const alice = await Effect.runPromise(
      banks.becomeClient({ bankId: bank.id, name: 'Alice' })
    );
    await Effect.runPromise(centralBank.setReserveRatio({ percent: '0' }));
    const debt = await Effect.runPromise(
      banks.lendToClient({
        bankId: bank.id,
        accountId: alice.id,
        amount: new Big('1000000'),
      })
    );
    expect(debt.eq('1100000')).toBe(true);
  });
});

describe('the lending rate dial', () => {
  it('a changed rate affects only the bank that set it', async () => {
    const first = await bankWithReserves('First Bank', '200');
    const second = await bankWithReserves('Second Bank', '100');
    const alice = await Effect.runPromise(
      banks.becomeClient({ bankId: first.id, name: 'Alice' })
    );
    const carol = await Effect.runPromise(
      banks.becomeClient({ bankId: second.id, name: 'Carol' })
    );
    const rate = await Effect.runPromise(
      banks.setInterestRate({ bankId: first.id, percent: '20' })
    );
    expect(rate.eq('0.20')).toBe(true);
    const atFirst = await Effect.runPromise(
      banks.lendToClient({
        bankId: first.id,
        accountId: alice.id,
        amount: new Big('1000'),
      })
    );
    expect(atFirst.eq('1200')).toBe(true);
    const atSecond = await Effect.runPromise(
      banks.lendToClient({
        bankId: second.id,
        accountId: carol.id,
        amount: new Big('500'),
      })
    );
    expect(atSecond.eq('550')).toBe(true);
  });

  it('rejects an invalid rate', async () => {
    const bank = await bankWithReserves('First Bank', '0');
    const error = await Effect.runPromise(
      Effect.flip(banks.setInterestRate({ bankId: bank.id, percent: '200' }))
    );
    expect(error).toBeInstanceOf(InvalidRateError);
  });
});

describe("the bank's own account", () => {
  it('is created together with the bank, holds its equity, and is not a client', async () => {
    const bank = await bankWithReserves('First Bank', '0');
    const books = await Effect.runPromise(
      banks.balanceSheet({ bankId: bank.id })
    );
    expect(books.ownAccount.owner).toBe('First Bank');
    expect(books.ownAccount.personId).toBe('');
    expect(books.equity.eq(0)).toBe(true);
    expect(books.accounts).toHaveLength(0);
    const clients = await Effect.runPromise(banks.listClients());
    expect(clients).toHaveLength(0);
  });
});

describe("task 4.4: paying from the bank's own account", () => {
  it("sends the bank's own money to another bank's account", async () => {
    // Two loans earn the central bank 400 of interest income; spending
    // it all into First Bank leaves that bank 200 in the black
    // (-200 of interest expense + 400 received).
    const first = await bankWithReserves('First Bank', '4000');
    const second = await bankWithReserves('Second Bank', '4000');
    await Effect.runPromise(
      centralBank.payToBank({ bankId: first.id, amount: new Big('400') })
    );
    const secondOwn = (
      await Effect.runPromise(banks.balanceSheet({ bankId: second.id }))
    ).ownAccount;
    const receipt = await Effect.runPromise(
      banks.payFromBankAccount({
        bankId: first.id,
        toIban: ibanFor(second.id, secondOwn.number),
        amount: new Big('150'),
      })
    );
    expect(receipt.kind).toBe('interbank');
    expect(receipt.recipient).toBe('Second Bank');
    // Reserves settled at the central bank, and both equity lines moved.
    const central = await Effect.runPromise(centralBank.balanceSheet());
    const reserves = new Map(
      central.reserveAccounts.map(account => [account.owner, account.balance])
    );
    expect(reserves.get('First Bank')?.eq('4250')).toBe(true);
    expect(reserves.get('Second Bank')?.eq('4150')).toBe(true);
    const firstBooks = await Effect.runPromise(
      banks.balanceSheet({ bankId: first.id })
    );
    const secondBooks = await Effect.runPromise(
      banks.balanceSheet({ bankId: second.id })
    );
    expect(firstBooks.equity.eq('50')).toBe(true);
    expect(secondBooks.equity.eq('-50')).toBe(true);
  });

  it('rejects paying when the bank owns less than the amount', async () => {
    // A fresh borrower is in the red: -5 of interest expense, nothing
    // earned yet — its own account cannot pay at all.
    const bank = await bankWithReserves('First Bank', '100');
    const other = await bankWithReserves('Second Bank', '0');
    const otherOwn = (
      await Effect.runPromise(banks.balanceSheet({ bankId: other.id }))
    ).ownAccount;
    const error = await Effect.runPromise(
      Effect.flip(
        banks.payFromBankAccount({
          bankId: bank.id,
          toIban: ibanFor(other.id, otherOwn.number),
          amount: new Big('1'),
        })
      )
    );
    expect(error).toBeInstanceOf(InsufficientFundsError);
  });
});
