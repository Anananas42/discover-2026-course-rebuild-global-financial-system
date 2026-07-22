/* oxlint-disable no-unused-vars -- imports here may be used only by the task bodies you will write. */
import { NotImplementedError } from '../../central-bank/src/bank-errors.ts';
// The commercial-bank layer: client accounts, loans, and transfers, on
// top of the central bank. Each bank's clients live in that bank's own
// books; a transfer that stays inside one bank is two rows in one ledger,
// while a transfer that crosses banks must also settle over the central
// bank's reserve accounts — the same `transferReserves` a student clicks
// by hand in the central-bank stages, now called by code.
//
// Money creation recurs here exactly as at the central bank: a bank lends
// to a client by crediting the client's deposit and recording a claim —
// deposits are how a client's account gets its first money (loans are the
// faucet), and repayment destroys the deposit again.
//
// Two things make a bank a business rather than a copy machine:
// - Interest: a loan's claim is the amount plus interest, and the
//   interest is credited to the bank's own account in its own books —
//   the equity account, opened with the bank. The bank spends from it like
//   any account (salaries, dividends), which is also how the interest it
//   earns gets back into circulation so that loans can actually be repaid.
// - The reserve requirement: a bank may only lend if its reserves at the
//   central bank stay at least the required share of its client deposits
//   afterwards — the central bank's dial (read live from its books), and
//   its brake on infinite lending.
//
// Conventions are the central-bank package's: state behind the dumb
// `Db`, every check here, one `input` object per public method and per
// db call, methods return `Effect.Effect<Result, PossibleErrors>`, and a
// step with more than one write commits them in one `db.transaction(...)`
// block. One deliberate exception: an interbank payment is three steps —
// accept (record the payment, debit the sender), settle (the central
// bank's own `transferReserves`, a transaction of its own), deliver (the
// receiving bank credits from the payment message) — because each
// institution writes only its own books, so no single transaction can
// span them. The payment row's status advances behind each step
// ('accepted' → 'settled' → 'completed'): a crash mid-payment strands
// money in flight, but the row always explains what is stuck, the
// receiver is never credited unsettled money, and money is never
// created or destroyed.

import Big from 'big.js';
import { Effect } from 'effect';

import type { CentralBank } from '@banks/central-bank/central-bank-service.ts';
import { requirePositiveAmount } from '@banks/central-bank/central-bank-service.ts';
import type {
  InvalidAmountError,
  InvalidRateError,
} from '@banks/central-bank/bank-errors.ts';
import {
  InsufficientReservesError,
  NoDebtToWriteOffError,
  RepaymentExceedsDebtError,
  SameBankError,
  UnknownBankError,
} from '@banks/central-bank/bank-errors.ts';
import { CURRENCY } from '@banks/central-bank/currency.ts';
import { interestOn, parseRate } from '@banks/central-bank/policy-rate.ts';
import { randomAccountNumber } from '@banks/db/account-number.ts';
import type { Account, Bank, Claim, Db } from '@banks/db/bank-db.ts';
import { randomPersonalId } from '@banks/db/person-id.ts';

import {
  ForeignIbanError,
  InsufficientFundsError,
  InvalidClientNameError,
  InvalidIbanError,
  MismatchedMessageError,
  NotAccountOwnerError,
  ReserveRequirementError,
  SameAccountError,
  UnknownAccountError,
  UnknownPersonError,
} from './commercial-bank-errors.ts';
import { bicFor, COUNTRY_CODE, ibanFor, parseIban } from './iban.ts';
import type { PaymentMessage } from './payment-message.ts';
import { DEFAULT_INTEREST_RATE, INTEREST_RATE_KEY } from './lending-policy.ts';

export interface BankBalanceSheet {
  bank: Bank;
  /** Liabilities: the clients' deposit accounts. */
  accounts: Account[];
  /** The bank's own account in its own books — its equity: interest
   *  income lands here, and the bank spends from here. */
  ownAccount: Account;
  /** Assets: outstanding loans to clients, keyed by personal id. */
  loans: Claim[];
  /** Client deposits only — the bank's own account is equity, not a
   *  deposit owed to anyone else. */
  totalDeposits: Big;
  totalLoans: Big;
  /** The own account's balance. */
  equity: Big;
  /** This bank's lending rate, as the stored ratio (0.10 = 10%). */
  interestRate: Big;
}

export interface Client {
  bankId: number;
  bankName: string;
  accountId: number;
  /** The bank-issued account number the IBAN is built from. */
  number: string;
  /** The holder's personal id — the person's unique identifier. */
  personId: string;
  owner: string;
  balance: Big;
  /** What this account's holder still owes this bank on their loan. */
  debt: Big;
}

export interface ClientAccount {
  account: Account;
  bank: Bank;
  /** What the client still owes the bank on their loan. */
  debt: Big;
}

export interface SendMoneyReceipt {
  /**
   * What the system decided from the IBAN alone: 'internal' stayed a
   * book transfer inside one bank; 'interbank' settled over the central
   * bank's reserves.
   */
  kind: 'internal' | 'interbank';
  /** Who was credited — the sender only knows an IBAN, the receipt
   *  names the counterparty, like a real statement. */
  recipient: string;
}

export class CommercialBanks {
  private db: Db;
  private centralBank: CentralBank;

  constructor(db: Db, centralBank: CentralBank) {
    this.db = db;
    this.centralBank = centralBank;
  }

  /**
   * A new person's first contact with the financial system: their
   * personal id is issued (in reality the state's job), and their first
   * account opens at the bank they chose. Names are labels — two people
   * may share one; the personal id is what tells them apart.
   */
  becomeClient(input: {
    bankId: number;
    name: string;
  }): Effect.Effect<Account, InvalidClientNameError | UnknownBankError> {
    const { bankId, name } = input;
    const requireBank = this.requireBank.bind(this);
    const requireClientName = this.requireClientName.bind(this);
    const issueAccount = this.issueAccount.bind(this);
    const findPersonAccounts = this.findPersonAccounts.bind(this);
    return Effect.gen(function* () {
      // TASK 5.1: Become a client
      // TODO: implement task 5.1.
      throw new NotImplementedError('5.1');
      // ENDTASK 5.1
    });
  }

  /** An existing person opens another account at a bank of their choice. */
  openAccount(input: {
    bankId: number;
    personId: string;
  }): Effect.Effect<Account, UnknownPersonError | UnknownBankError> {
    const { bankId, personId } = input;
    const requireBank = this.requireBank.bind(this);
    const issueAccount = this.issueAccount.bind(this);
    const findPersonAccounts = this.findPersonAccounts.bind(this);
    return Effect.gen(function* () {
      // TASK 5.2: Open another account
      // TODO: implement task 5.2.
      throw new NotImplementedError('5.2');
      // ENDTASK 5.2
    });
  }

  /**
   * Creates money by lending — the same mechanic as the central bank's,
   * one layer down: credit the client's deposit, record the bank's claim.
   * This is how an account gets its first money. Two additions over the
   * central bank's version: the claim is the amount plus interest — the
   * interest is the bank's income, credited to its own account — and the
   * loan is only allowed if the bank's reserves stay at least
   * RESERVE_RATIO of its client deposits afterwards. Returns the
   * borrower's total debt after the loan.
   */
  lendToClient(input: {
    bankId: number;
    accountId: number;
    amount: Big;
  }): Effect.Effect<
    Big,
    | UnknownBankError
    | UnknownAccountError
    | InvalidAmountError
    | ReserveRequirementError
  > {
    const { bankId, accountId, amount } = input;
    const db = this.db;
    const accountRepo = this.db.accounts;
    const claimRepo = this.db.claims;
    const centralBank = this.centralBank;
    const requireAccount = this.requireAccount.bind(this);
    const interestRate = this.interestRate.bind(this);
    return Effect.gen(function* () {
      // TASK 7.1: Lend to a client
      // TODO: implement task 7.1.
      throw new NotImplementedError('7.1');
      // ENDTASK 7.1
    });
  }

  /**
   * A bank's lending rate, as the stored ratio (0.10 = 10%). Each bank
   * prices its own loans; the rate lives in that bank's books, and the
   * default is seeded on first read so the Database view shows it. The
   * bank's schema must already exist — every caller has resolved the
   * bank first.
   */
  interestRate(input: { bankId: number }): Effect.Effect<Big> {
    const { bankId } = input;
    const settingRepo = this.db.settings;
    return Effect.gen(function* () {
      const stored = yield* Effect.promise(() =>
        settingRepo.get({ books: bankId, key: INTEREST_RATE_KEY })
      );
      if (stored !== undefined) return new Big(stored);
      yield* Effect.promise(() =>
        settingRepo.set({
          books: bankId,
          key: INTEREST_RATE_KEY,
          value: DEFAULT_INTEREST_RATE.toString(),
        })
      );
      return DEFAULT_INTEREST_RATE;
    });
  }

  /**
   * The bank sets its lending rate, from a percentage as typed ('12.5').
   * Only loans made after the change carry the new rate — existing
   * claims keep the price they were made at. Prebuilt, not a task:
   * storing a rate was task 2.4's lesson, and a near-verbatim rerun
   * would teach nothing — the dial is still the bank's own price, set
   * from its screen. Returns the stored ratio.
   */
  setInterestRate(input: {
    bankId: number;
    percent: string;
  }): Effect.Effect<Big, UnknownBankError | InvalidRateError> {
    const { bankId, percent } = input;
    const settingRepo = this.db.settings;
    const requireBank = this.requireBank.bind(this);
    return Effect.gen(function* () {
      const bank = yield* requireBank(bankId);
      const rate = yield* parseRate(percent);
      yield* Effect.promise(() =>
        settingRepo.set({
          books: bank.id,
          key: INTEREST_RATE_KEY,
          value: rate.toString(),
        })
      );
      return rate;
    });
  }

  /**
   * A default made official: the borrower cannot (or will not) repay, so
   * the bank deletes its claim and takes the loss on its own account —
   * which may go negative: an insolvent bank, visible on its balance
   * sheet. The borrower's deposits are untouched; a default destroys the
   * lender's asset, never the money. Returns the written-off amount.
   */
  writeOffLoan(input: {
    bankId: number;
    personId: string;
  }): Effect.Effect<Big, UnknownBankError | NoDebtToWriteOffError> {
    const { bankId, personId } = input;
    const db = this.db;
    const claimRepo = this.db.claims;
    const requireBank = this.requireBank.bind(this);
    const requireOwnAccount = this.requireOwnAccount.bind(this);
    return Effect.gen(function* () {
      // TASK 7.2: Write off a loan
      // TODO: implement task 7.2.
      throw new NotImplementedError('7.2');
      // ENDTASK 7.2
    });
  }

  /**
   * The bank spends: pays from its own account — the equity that interest
   * income built up — to any IBAN, exactly like any other payment
   * (salaries, dividends, rent). This is how the interest a bank earns
   * returns to circulation, and without it clients could never repay more
   * than they were lent.
   */
  payFromBankAccount(input: {
    bankId: number;
    toIban: string;
    amount: Big;
  }): Effect.Effect<
    SendMoneyReceipt,
    | InvalidIbanError
    | ForeignIbanError
    | UnknownBankError
    | UnknownAccountError
    | SameAccountError
    | InvalidAmountError
    | InsufficientFundsError
    | InsufficientReservesError
  > {
    const { bankId, toIban, amount } = input;
    const transfer = this.transfer.bind(this);
    const requireBank = this.requireBank.bind(this);
    const requireOwnAccount = this.requireOwnAccount.bind(this);
    return Effect.gen(function* () {
      // TASK 4.4: Pay from the bank's own account
      // TODO: implement task 4.4.
      throw new NotImplementedError('4.4');
      // ENDTASK 4.4
    });
  }

  /**
   * Destroys money: the repayment leaves the client's deposit and shrinks
   * the bank's claim by the same amount. Any account may repay only its
   * own holder's loan — that is all it can reach, since loans are keyed
   * by the personal id. Returns the remaining debt; a loan repaid to
   * zero disappears from the books.
   */
  repayLoan(input: {
    bankId: number;
    accountId: number;
    amount: Big;
  }): Effect.Effect<
    Big,
    | UnknownBankError
    | UnknownAccountError
    | InvalidAmountError
    | InsufficientFundsError
    | RepaymentExceedsDebtError
  > {
    const { bankId, accountId, amount } = input;
    const db = this.db;
    const claimRepo = this.db.claims;
    const requireAccount = this.requireAccount.bind(this);
    const requireFunds = this.requireFunds.bind(this);
    return Effect.gen(function* () {
      // TASK 8.1: Repay a loan
      // TODO: implement task 8.1.
      throw new NotImplementedError('8.1');
      // ENDTASK 8.1
    });
  }

  /**
   * The receiving bank's half of an interbank payment: an incoming
   * message names the recipient only by IBAN, and the bank credits that
   * account in its own books — the only books it can write. The bank
   * code inside the IBAN says whose books those are; the check digits
   * catch a corrupted address; a foreign IBAN is turned down until the
   * cross-border lessons. By the time a real message arrives, the
   * reserves have already settled at the central bank; the message is
   * all the receiving bank knows, and all it needs. A message for an
   * account number nobody holds is refused (in reality the payment
   * would bounce back to the sender — the teacher's caveat), and so is
   * a message naming this bank itself as the sender: an on-us payment
   * never becomes a message. Returns the credited account, so the
   * sender can name the recipient on the receipt.
   */
  receivePayment(
    input: PaymentMessage
  ): Effect.Effect<
    Account,
    | InvalidIbanError
    | ForeignIbanError
    | MismatchedMessageError
    | SameBankError
    | UnknownBankError
    | UnknownAccountError
    | InvalidAmountError
  > {
    const { fromBic, fromIban, toBic, toIban, amount } = input;
    const accountRepo = this.db.accounts;
    const requireAccountByNumber = this.requireAccountByNumber.bind(this);
    return Effect.gen(function* () {
      // TASK 4.2: Receive a payment
      // TODO: implement task 4.2.
      throw new NotImplementedError('4.2');
      // ENDTASK 4.2
    });
  }

  /**
   * The transfer at the heart of every payment: moves money from one
   * account to another, addressed by bank and account number. Prebuilt,
   * not a task — the engine only resolves the parties and checks the
   * order (read and check first: the amount, both accounts, the funds,
   * and for an interbank payment the reserves that will settle it), then
   * routes the actual movement: to `internalTransfer` when both accounts
   * are at one bank, to `interbankTransfer` when the payment crosses
   * banks. Every payment operation — a person sending money, a bank
   * paying salaries — resolves its parties and ends up here.
   */
  transfer(input: {
    fromBankId: number;
    fromAccountId: number;
    toBankId: number;
    toAccountNumber: string;
    amount: Big;
  }): Effect.Effect<
    SendMoneyReceipt,
    | UnknownBankError
    | UnknownAccountError
    | SameAccountError
    | InvalidAmountError
    | InsufficientFundsError
    | InsufficientReservesError
  > {
    const { fromBankId, fromAccountId, toBankId, toAccountNumber, amount } =
      input;
    const internalTransfer = this.internalTransfer.bind(this);
    const interbankTransfer = this.interbankTransfer.bind(this);
    const requireAccount = this.requireAccount.bind(this);
    const requireAccountByNumber = this.requireAccountByNumber.bind(this);
    const requireFunds = this.requireFunds.bind(this);
    const requireSettlementCover = this.requireSettlementCover.bind(this);
    return Effect.gen(function* () {
      yield* requirePositiveAmount(amount);
      const { account: sender, bank: senderBank } = yield* requireAccount({
        bankId: fromBankId,
        accountId: fromAccountId,
      });
      const receiver = yield* requireAccountByNumber(toBankId, toAccountNumber);
      if (toBankId === fromBankId && receiver.id === sender.id) {
        return yield* Effect.fail(
          new SameAccountError({ accountId: fromAccountId })
        );
      }
      yield* requireFunds(sender, amount);
      if (fromBankId === toBankId) {
        yield* internalTransfer({
          bankId: fromBankId,
          sender,
          receiver,
          amount,
        });
        return { kind: 'internal', recipient: receiver.owner };
      }
      // Read and check first: the reserves must cover the settlement, so
      // a payment is never accepted only to fail mid-flight.
      yield* requireSettlementCover(senderBank, amount);
      yield* interbankTransfer({
        senderBank,
        sender,
        toBankId,
        receiver,
        amount,
      });
      return { kind: 'interbank', recipient: receiver.owner };
    });
  }

  /**
   * A transfer that stays inside one bank: no other institution is
   * involved, no reserves move, no message is sent — the two balances
   * change in this bank's own database, and they change together. The
   * engine has already resolved both accounts and checked the order.
   */
  internalTransfer(input: {
    bankId: number;
    sender: Account;
    receiver: Account;
    amount: Big;
  }): Effect.Effect<void> {
    const { bankId, sender, receiver, amount } = input;
    const db = this.db;
    return Effect.gen(function* () {
      // TASK 4.1: Transfer within a bank
      // TODO: implement task 4.1.
      throw new NotImplementedError('4.1');
      // ENDTASK 4.1
    });
  }

  /**
   * A payment that crosses banks, in three steps — each institution
   * changes only its own database, so no single transaction can span
   * them: the sending bank records the payment and debits its client
   * (one transaction — the row is born 'accepted'), the central bank
   * settles the reserves (a transaction of its own — the student's
   * stage-3 operation, called by this code), and the receiving bank
   * credits the recipient from the payment message alone. The payment
   * row's status advances behind each step, so a crash mid-payment
   * always leaves a row explaining what is in flight — money can leave
   * the sender and not yet have arrived, exactly as in reality, but it
   * can never arrive unsettled, and is never created or destroyed. The
   * engine has already resolved the parties and checked the order,
   * reserves included.
   */
  interbankTransfer(input: {
    senderBank: Bank;
    sender: Account;
    toBankId: number;
    receiver: Account;
    amount: Big;
  }): Effect.Effect<
    void,
    | UnknownBankError
    | UnknownAccountError
    | InvalidAmountError
    | InsufficientReservesError
  > {
    const { senderBank, sender, toBankId, receiver, amount } = input;
    const db = this.db;
    const paymentRepo = this.db.payments;
    const settleReserves = this.settleReserves.bind(this);
    const deliverPayment = this.deliverPayment.bind(this);
    return Effect.gen(function* () {
      // TASK 4.3: Transfer between banks
      // TODO: implement task 4.3.
      throw new NotImplementedError('4.3');
      // ENDTASK 4.3
    });
  }

  /**
   * Sends money from a person's own account to an IBAN. The bank is
   * encoded in the IBAN, so this method — never the sender — decides
   * where the transfer goes; a foreign IBAN is rejected, routing it
   * abroad comes with the interbank lessons. A payment order is only
   * honored from the account's holder: the sending account must belong
   * to the person giving the order.
   */
  sendMoney(input: {
    personId: string;
    fromBankId: number;
    fromAccountId: number;
    toIban: string;
    amount: Big;
  }): Effect.Effect<
    SendMoneyReceipt,
    | InvalidIbanError
    | ForeignIbanError
    | UnknownBankError
    | UnknownAccountError
    | NotAccountOwnerError
    | SameAccountError
    | InvalidAmountError
    | InsufficientFundsError
    | InsufficientReservesError
  > {
    const { personId, fromBankId, fromAccountId, toIban, amount } = input;
    const transfer = this.transfer.bind(this);
    const requireAccount = this.requireAccount.bind(this);
    return Effect.gen(function* () {
      // TASK 6.1: Send money to an IBAN
      // TODO: implement task 6.1.
      throw new NotImplementedError('6.1');
      // ENDTASK 6.1
    });
  }

  /** A bank's balance sheet: deposit accounts, loans, and its own
   *  account (the equity), listed apart from the clients'. */
  balanceSheet(input: {
    bankId: number;
  }): Effect.Effect<BankBalanceSheet, UnknownBankError> {
    const { bankId } = input;
    const accountRepo = this.db.accounts;
    const claimRepo = this.db.claims;
    const requireBank = this.requireBank.bind(this);
    const requireOwnAccount = this.requireOwnAccount.bind(this);
    const interestRate = this.interestRate.bind(this);
    return Effect.gen(function* () {
      const bank = yield* requireBank(bankId);
      const all = yield* Effect.promise(() =>
        accountRepo.list({ books: bankId })
      );
      const ownAccount = yield* requireOwnAccount(bankId, bank.name);
      const accounts = all.filter(account => account.personId !== '');
      const loans = yield* Effect.promise(() =>
        claimRepo.list({ books: bankId })
      );
      const zero = new Big(0);
      return {
        bank,
        accounts,
        ownAccount,
        loans,
        totalDeposits: accounts.reduce(
          (sum, account) => sum.plus(account.balance),
          zero
        ),
        totalLoans: loans.reduce((sum, loan) => sum.plus(loan.amount), zero),
        equity: ownAccount.balance,
        interestRate: yield* interestRate({ bankId }),
      };
    });
  }

  /** Every client account in the country, across all banks. The banks'
   *  own accounts are not client accounts and stay out. */
  listClients(): Effect.Effect<Client[]> {
    const bankRepo = this.db.banks;
    const accountRepo = this.db.accounts;
    const claimRepo = this.db.claims;
    return Effect.gen(function* () {
      const banks = yield* Effect.promise(() => bankRepo.list());
      const clients: Client[] = [];
      for (const bank of banks) {
        const accounts = (yield* Effect.promise(() =>
          accountRepo.list({ books: bank.id })
        )).filter(account => account.personId !== '');
        const claims = yield* Effect.promise(() =>
          claimRepo.list({ books: bank.id })
        );
        const debtByBorrower = new Map(
          claims.map(claim => [claim.borrower, claim.amount])
        );
        for (const account of accounts) {
          clients.push({
            bankId: bank.id,
            bankName: bank.name,
            accountId: account.id,
            number: account.number,
            personId: account.personId,
            owner: account.owner,
            balance: account.balance,
            debt: debtByBorrower.get(account.personId) ?? new Big(0),
          });
        }
      }
      return clients;
    });
  }

  /**
   * Renames a person everywhere their accounts are. The name is a label
   * and needs no uniqueness — two people may share one; the personal id
   * is the identity, and loans are keyed by it, so nothing but the label
   * changes. Returns how many accounts were relabeled.
   */
  renamePerson(input: {
    personId: string;
    newName: string;
  }): Effect.Effect<number, InvalidClientNameError | UnknownPersonError> {
    const { personId, newName } = input;
    const db = this.db;
    const requireClientName = this.requireClientName.bind(this);
    const findPersonAccounts = this.findPersonAccounts.bind(this);
    return Effect.gen(function* () {
      // TASK 5.3: Rename a person
      // TODO: implement task 5.3.
      throw new NotImplementedError('5.3');
      // ENDTASK 5.3
    });
  }

  /** One client's view: their account, their bank, their debt. */
  account(input: {
    bankId: number;
    accountId: number;
  }): Effect.Effect<ClientAccount, UnknownBankError | UnknownAccountError> {
    const { bankId, accountId } = input;
    const claimRepo = this.db.claims;
    const requireAccount = this.requireAccount.bind(this);
    return Effect.gen(function* () {
      const { account, bank } = yield* requireAccount({ bankId, accountId });
      const claim = yield* Effect.promise(() =>
        claimRepo.getByBorrower({ books: bankId, borrower: account.personId })
      );
      return { account, bank, debt: claim?.amount ?? new Big(0) };
    });
  }

  /** Every account a person holds, across all banks. The empty personal
   *  id marks institutions' own accounts — it never identifies a person. */
  private findPersonAccounts(
    personId: string
  ): Effect.Effect<{ bank: Bank; account: Account }[]> {
    const bankRepo = this.db.banks;
    const accountRepo = this.db.accounts;
    return Effect.gen(function* () {
      if (personId === '') return [];
      const banks = yield* Effect.promise(() => bankRepo.list());
      const found: { bank: Bank; account: Account }[] = [];
      for (const bank of banks) {
        const accounts = yield* Effect.promise(() =>
          accountRepo.listByPersonId({ books: bank.id, personId })
        );
        for (const account of accounts) found.push({ bank, account });
      }
      return found;
    });
  }

  /** The bank issues the account number: random, unique in its books. */
  private issueAccount(input: {
    bankId: number;
    owner: string;
    personId: string;
  }): Effect.Effect<Account> {
    const { bankId, owner, personId } = input;
    const accountRepo = this.db.accounts;
    return Effect.gen(function* () {
      const number = yield* Effect.promise(async () => {
        for (;;) {
          const candidate = randomAccountNumber();
          const taken = await accountRepo.getByNumber({
            books: bankId,
            number: candidate,
          });
          if (!taken) return candidate;
        }
      });
      return yield* Effect.promise(() =>
        accountRepo.create({ books: bankId, owner, number, personId })
      );
    });
  }

  /**
   * Settlement for a payment that crosses banks: moves the reserves at
   * the central bank, in a transaction of the central bank's own. The
   * two banks are different by construction wherever this is called, so
   * settlement's same-bank refusal cannot occur — it is folded away as a
   * defect here, and callers need not handle it.
   */
  private settleReserves(input: {
    fromBankId: number;
    toBankId: number;
    amount: Big;
  }): Effect.Effect<
    void,
    UnknownBankError | InvalidAmountError | InsufficientReservesError
  > {
    return this.centralBank
      .transferReserves(input)
      .pipe(Effect.catchTag('SameBankError', error => Effect.die(error)));
  }

  /**
   * Delivery for the message a transfer just built: hands it to the
   * receiving bank. The address comes from `ibanFor`, so it is valid
   * and domestic by construction — those refusals are folded away as
   * defects, like settlement's same-bank guard, and callers need not
   * handle them; the account refusals stay real.
   */
  private deliverPayment(
    message: PaymentMessage
  ): Effect.Effect<
    Account,
    UnknownBankError | UnknownAccountError | InvalidAmountError
  > {
    return this.receivePayment(message).pipe(
      Effect.catchTag('InvalidIbanError', error => Effect.die(error)),
      Effect.catchTag('ForeignIbanError', error => Effect.die(error)),
      Effect.catchTag('MismatchedMessageError', error => Effect.die(error)),
      Effect.catchTag('SameBankError', error => Effect.die(error))
    );
  }

  /**
   * A registered bank, or the refusal every bank-taking operation
   * shares — the same helper the central bank keeps.
   */
  private requireBank(bankId: number): Effect.Effect<Bank, UnknownBankError> {
    const bankRepo = this.db.banks;
    return Effect.gen(function* () {
      const bank = yield* Effect.promise(() => bankRepo.get({ id: bankId }));
      if (!bank) return yield* Effect.fail(new UnknownBankError({ bankId }));
      return bank;
    });
  }

  /**
   * The bank's own account in its own books, opened with the bank. Its
   * absence is corrupted state (or books created before the equity
   * account existed — Reset cures that), so it is a defect.
   */
  private requireOwnAccount(
    bankId: number,
    bankName: string
  ): Effect.Effect<Account> {
    const accountRepo = this.db.accounts;
    return Effect.gen(function* () {
      const accounts = yield* Effect.promise(() =>
        accountRepo.list({ books: bankId })
      );
      const ownAccount = accounts.find(account => account.personId === '');
      if (!ownAccount) {
        return yield* Effect.dieMessage(
          `${bankName} has no own account in its books — reset the database if it was created before equity accounts existed.`
        );
      }
      return ownAccount;
    });
  }

  /**
   * Read-and-check for the interbank leg: the sending bank's reserves at
   * the central bank must cover the settlement before the payment is
   * accepted, so it can never be accepted only to fail mid-flight (a
   * real system would queue or bounce it — the teacher's caveat). Reads
   * the central bank's books the way the reserve requirement does.
   */
  private requireSettlementCover(
    bank: Bank,
    amount: Big
  ): Effect.Effect<void, InsufficientReservesError> {
    const accountRepo = this.db.accounts;
    return Effect.gen(function* () {
      const reserve = yield* Effect.promise(() =>
        accountRepo.getByOwner({ books: 'central-bank', owner: bank.name })
      );
      if (!reserve) {
        return yield* Effect.dieMessage(
          `${bank.name} is registered but has no reserve account.`
        );
      }
      if (reserve.balance.lt(amount)) {
        return yield* Effect.fail(
          new InsufficientReservesError({
            bank: bank.name,
            balance: reserve.balance.toFixed(CURRENCY.decimals),
            requested: amount.toFixed(CURRENCY.decimals),
          })
        );
      }
    });
  }

  /**
   * Checks an account can cover an amount, or refuses with the
   * insufficient-funds error every money-spending operation shares. The
   * check is written out by hand once at the central bank (task 2.2);
   * every payment here leans on the helper — the refusal still lives in
   * every signature.
   */
  private requireFunds(
    account: Account,
    amount: Big
  ): Effect.Effect<void, InsufficientFundsError> {
    return Effect.gen(function* () {
      if (account.balance.lt(amount)) {
        return yield* Effect.fail(
          new InsufficientFundsError({
            owner: account.owner,
            balance: account.balance.toFixed(CURRENCY.decimals),
            requested: amount.toFixed(CURRENCY.decimals),
          })
        );
      }
    });
  }

  /**
   * A usable person's name — trimmed and non-empty — or the refusal both
   * naming operations share. Task 1.1 writes the same check out by hand
   * for bank names; here the helper carries it.
   */
  private requireClientName(
    name: string
  ): Effect.Effect<string, InvalidClientNameError> {
    return Effect.gen(function* () {
      const trimmed = name.trim();
      if (trimmed === '') {
        return yield* Effect.fail(
          new InvalidClientNameError({ name, reason: 'must not be empty' })
        );
      }
      return trimmed;
    });
  }

  private requireAccount(input: {
    bankId: number;
    accountId: number;
  }): Effect.Effect<
    { account: Account; bank: Bank },
    UnknownBankError | UnknownAccountError
  > {
    const { bankId, accountId } = input;
    const accountRepo = this.db.accounts;
    const requireBank = this.requireBank.bind(this);
    return Effect.gen(function* () {
      const bank = yield* requireBank(bankId);
      const account = yield* Effect.promise(() =>
        accountRepo.get({ books: bankId, id: accountId })
      );
      if (!account) {
        return yield* Effect.fail(
          new UnknownAccountError({ bankId, account: String(accountId) })
        );
      }
      return { account, bank };
    });
  }

  /** Resolves a recipient the way a receiving bank does: by the account
   *  number carried in the payment, bouncing unknowns. */
  private requireAccountByNumber(
    bankId: number,
    accountNumber: string
  ): Effect.Effect<Account, UnknownBankError | UnknownAccountError> {
    const accountRepo = this.db.accounts;
    const requireBank = this.requireBank.bind(this);
    return Effect.gen(function* () {
      yield* requireBank(bankId);
      const account = yield* Effect.promise(() =>
        accountRepo.getByNumber({ books: bankId, number: accountNumber })
      );
      if (!account) {
        return yield* Effect.fail(
          new UnknownAccountError({ bankId, account: accountNumber })
        );
      }
      return account;
    });
  }
}
