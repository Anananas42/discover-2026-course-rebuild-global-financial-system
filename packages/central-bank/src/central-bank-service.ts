/* oxlint-disable no-unused-vars -- imports here may be used only by the task bodies you will write. */
// The central bank: it licenses banks, issues the currency, and settles
// payments between banks. Money is created the way real central banks
// create it — not from a pot, but by balance-sheet expansion: lending to
// a bank credits the bank's reserve account (a liability of the central
// bank) and records a claim on that bank (an asset) — a claim is the
// lender's side of a loan. The balance sheet must always balance: total claims =
// banks' reserves + the central bank's equity.
//
// Lending charges the policy rate — the central bank interest rate, as
// the guide calls it (policy-rate.ts — stored in the books, set by the
// central banker, applied to new loans only): the claim is the
// amount plus interest, the interest is the central bank's income —
// credited to its own account, its equity — and the same interest is the
// borrowing bank's expense, debited from that bank's own account. The
// central bank spends its income back into the system with `payToBank`
// (in reality: interest on reserves, salaries), which is the only way
// banks can ever repay more than was created.
//
// Conventions for this package:
// - State lives in the database behind the prepared `Db` (@banks/db).
//   The db only reads and writes rows; every check and guarantee is the
//   job of the code here. No SQL is ever written in this package.
// - Every public method takes one `input` object, and so does every db
//   call: a call site names every field it passes, so nothing can be
//   swapped silently — and the wire, the log, and the code all show the
//   same named fields.
// - Read and check first, then write. A single write is atomic on its
//   own; a step with more than one write commits them in one
//   `db.transaction(...)` block, so a crash can never leave half an
//   operation on the books.
// - Methods return `Effect.Effect<Result, PossibleErrors>`: the signature
//   states what a method returns and every way it can fail. Inside a
//   method, other methods are called with `yield*` and failures are
//   reported with `yield* Effect.fail(...)`.
// - Claims key the borrower by id — the bank id here, the personal id at
//   the commercial layer; balance sheets resolve display names.

import Big from 'big.js';
import { Effect } from 'effect';

import { randomAccountNumber } from '@banks/db/account-number.ts';
import type { Account, CommercialBank, Claim, Db } from '@banks/db/bank-db.ts';

import {
  DuplicateBankNameError,
  InsufficientCentralBankFundsError,
  InsufficientReservesError,
  InvalidAmountError,
  InvalidBankNameError,
  InvalidRateError,
  NoDebtToWriteOffError,
  NotImplementedError,
  RepaymentExceedsDebtError,
  SameBankError,
  UnknownBankError,
} from './bank-errors.ts';
import { CURRENCY } from './currency.ts';
import {
  DEFAULT_POLICY_RATE,
  interestOn,
  parseRate,
  POLICY_RATE_KEY,
} from './policy-rate.ts';
import { DEFAULT_RESERVE_RATIO, RESERVE_RATIO_KEY } from './reserve-policy.ts';

/** The central bank's own account carries this owner label, which is why
 *  no commercial bank may register under it. */
export const CENTRAL_BANK_NAME = 'Central bank';

export interface CentralBankBalanceSheet {
  /** Liabilities: the banks' reserve accounts. */
  reserveAccounts: Account[];
  /** Assets: outstanding claims on the banks. The raw books key the
   *  borrower by bank id; here it carries the bank's name as label. */
  claims: Claim[];
  totalReserves: Big;
  totalClaims: Big;
  /** The central bank's own account's balance — its accumulated interest
   *  income, spendable via payToBank. */
  equity: Big;
}

/**
 * Checks that an amount already in hand is positive and has no more
 * decimal places than the currency has.
 */
export function requirePositiveAmount(
  amount: Big
): Effect.Effect<Big, InvalidAmountError> {
  return Effect.gen(function* () {
    if (amount.lte(0)) {
      return yield* Effect.fail(
        new InvalidAmountError({
          amount: amount.toString(),
          reason: 'must be positive',
        })
      );
    }
    if (!amount.round(CURRENCY.decimals).eq(amount)) {
      return yield* Effect.fail(
        new InvalidAmountError({
          amount: amount.toString(),
          reason: `${CURRENCY.code} has ${CURRENCY.decimals} decimal places`,
        })
      );
    }
    return amount;
  });
}

/**
 * Parses a raw typed amount into a checked Big — the boundary where
 * money enters as text (forms, the API); past it, amounts travel as Big
 * values and are re-checked with `requirePositiveAmount`.
 */
export function parseAmount(
  raw: string
): Effect.Effect<Big, InvalidAmountError> {
  return Effect.gen(function* () {
    let amount: Big;
    try {
      amount = new Big(raw.trim());
    } catch {
      return yield* Effect.fail(
        new InvalidAmountError({ amount: raw, reason: 'not a number' })
      );
    }
    return yield* requirePositiveAmount(amount);
  });
}

export class CentralBank {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /**
   * Licenses a new bank: registers it, creates its (empty) books, and
   * opens its reserve account here at the central bank.
   */
  registerBank(input: {
    name: string;
  }): Effect.Effect<
    CommercialBank,
    InvalidBankNameError | DuplicateBankNameError
  > {
    const { name } = input;
    const db = this.db;
    const commercialBankRepo = this.db.commercialBanks;
    return Effect.gen(function* () {
      // TASK 1.1: Open a new bank
      // TODO: implement task 1.1.
      throw new NotImplementedError('1.1');
      // ENDTASK 1.1
    });
  }

  /**
   * Creates money by lending: credits the bank's reserve account and
   * records a claim on the bank. There is no pot this money comes from —
   * both sides of the balance sheet grow together. The claim is the
   * amount plus interest at the policy rate: the interest is the central
   * bank's income (credited to its own account) and the borrowing bank's
   * expense (debited from that bank's own account — a fresh bank is in
   * the red until it earns by lending on). interestOn (policy-rate.ts)
   * computes the interest. Returns the bank's total debt after the loan.
   */
  lendToBank(input: {
    bankId: number;
    amount: Big;
  }): Effect.Effect<Big, UnknownBankError | InvalidAmountError> {
    const { bankId, amount } = input;
    const db = this.db;
    const commercialBankRepo = this.db.commercialBanks;
    const claimRepo = this.db.claims;
    const requireReserveAccount = this.requireReserveAccount.bind(this);
    const requireOwnAccount = this.requireOwnAccount.bind(this);
    const requireBankOwnAccount = this.requireBankOwnAccount.bind(this);
    const policyRate = this.policyRate.bind(this);
    return Effect.gen(function* () {
      // TASK 2.1: Lend to a bank
      // TODO: implement task 2.1.
      throw new NotImplementedError('2.1');
      // ENDTASK 2.1
    });
  }

  /**
   * The current policy rate, as the stored ratio (0.05 = 5%). Kept in
   * the central bank's books; the default is seeded on first read, so
   * the Database view always shows the live value.
   */
  policyRate(): Effect.Effect<Big> {
    const settingRepo = this.db.settings;
    return Effect.gen(function* () {
      const stored = yield* Effect.promise(() =>
        settingRepo.get({ books: 'central-bank', key: POLICY_RATE_KEY })
      );
      if (stored !== undefined) return new Big(stored);
      yield* Effect.promise(() =>
        settingRepo.set({
          books: 'central-bank',
          key: POLICY_RATE_KEY,
          value: DEFAULT_POLICY_RATE.toString(),
        })
      );
      return DEFAULT_POLICY_RATE;
    });
  }

  /**
   * Sets the policy rate, from a percentage as typed ('4.75'): parseRate
   * (policy-rate.ts) checks it and converts it to the ratio, stored
   * under POLICY_RATE_KEY. Only loans made after the change carry the
   * new rate — existing claims keep the price they were made at, like a
   * signed loan contract. Returns the stored ratio.
   */
  setPolicyRate(input: {
    percent: string;
  }): Effect.Effect<Big, InvalidRateError> {
    const { percent } = input;
    const settingRepo = this.db.settings;
    return Effect.gen(function* () {
      // TASK 2.4: Set the central bank interest rate
      // TODO: implement task 2.4.
      throw new NotImplementedError('2.4');
      // ENDTASK 2.4
    });
  }

  /**
   * The central bank spends: pays from its own account — the interest
   * income it earned — into a bank, crediting both the bank's reserves
   * and the bank's equity (in reality: interest on reserves, services).
   * This is how the central bank's income returns to the system; without
   * it, banks could never repay more than was created. Refusal messages
   * state the numbers to the currency's decimal places — CURRENCY
   * (currency.ts) carries them.
   */
  payToBank(input: {
    bankId: number;
    amount: Big;
  }): Effect.Effect<
    void,
    UnknownBankError | InvalidAmountError | InsufficientCentralBankFundsError
  > {
    const { bankId, amount } = input;
    const db = this.db;
    const requireBank = this.requireBank.bind(this);
    const requireReserveAccount = this.requireReserveAccount.bind(this);
    const requireOwnAccount = this.requireOwnAccount.bind(this);
    const requireBankOwnAccount = this.requireBankOwnAccount.bind(this);
    return Effect.gen(function* () {
      // TASK 3.2: Pay a bank
      // TODO: implement task 3.2.
      throw new NotImplementedError('3.2');
      // ENDTASK 3.2
    });
  }

  /**
   * Moves reserves between two banks' accounts — the settlement operation
   * behind every payment that crosses a bank boundary. Transfers conserve
   * money: this is the one operation that must never create or destroy it.
   * Called bare — the workbench's Debug lever — it moves an asset with
   * nothing settled, and both banks' sheets stop balancing until it is
   * moved back; a whole payment always pairs it with the client legs.
   */
  transferReserves(input: {
    fromBankId: number;
    toBankId: number;
    amount: Big;
  }): Effect.Effect<
    void,
    | UnknownBankError
    | SameBankError
    | InvalidAmountError
    | InsufficientReservesError
  > {
    const { fromBankId, toBankId, amount } = input;
    const db = this.db;
    const requireBank = this.requireBank.bind(this);
    const requireReserveAccount = this.requireReserveAccount.bind(this);
    const requireReserves = this.requireReserves.bind(this);
    return Effect.gen(function* () {
      // TASK 3.1: Transfer reserves
      // TODO: implement task 3.1.
      throw new NotImplementedError('3.1');
      // ENDTASK 3.1
    });
  }

  /**
   * Destroys money: a bank repays its debt, so its reserves are debited
   * and the claim on it shrinks by the same amount — both sides of the
   * balance sheet contract together. Returns the remaining debt; a claim
   * repaid to zero disappears from the balance sheet. Refusal messages state the
   * numbers to the currency's decimal places — CURRENCY (currency.ts)
   * carries them.
   */
  receiveRepayment(input: {
    bankId: number;
    amount: Big;
  }): Effect.Effect<
    Big,
    | UnknownBankError
    | InvalidAmountError
    | InsufficientReservesError
    | RepaymentExceedsDebtError
  > {
    const { bankId, amount } = input;
    const db = this.db;
    const claimRepo = this.db.claims;
    const requireBank = this.requireBank.bind(this);
    const requireReserveAccount = this.requireReserveAccount.bind(this);
    return Effect.gen(function* () {
      // TASK 2.2: Receive a repayment
      // TODO: implement task 2.2.
      throw new NotImplementedError('2.2');
      // ENDTASK 2.2
    });
  }

  /** The central bank's balance sheet: reserve accounts, claims, and its
   *  own account's balance (the equity), listed apart from the banks'.
   *  Claims are keyed by bank id in the raw books; here each carries the
   *  bank's name as label. A read never writes: before the first
   *  operation creates the own account, equity is simply zero. */
  balanceSheet(): Effect.Effect<CentralBankBalanceSheet> {
    const accountRepo = this.db.accounts;
    const claimRepo = this.db.claims;
    const commercialBankRepo = this.db.commercialBanks;
    return Effect.gen(function* () {
      const ownAccount = yield* Effect.promise(() =>
        accountRepo.getByOwner({
          books: 'central-bank',
          owner: CENTRAL_BANK_NAME,
        })
      );
      const accounts = yield* Effect.promise(() =>
        accountRepo.list({ books: 'central-bank' })
      );
      const reserveAccounts = accounts.filter(
        account => account.id !== ownAccount?.id
      );
      const rawClaims = yield* Effect.promise(() =>
        claimRepo.list({ books: 'central-bank' })
      );
      const banks = yield* Effect.promise(() => commercialBankRepo.list());
      const nameById = new Map(banks.map(bank => [String(bank.id), bank.name]));
      const claims = rawClaims.map(claim => ({
        ...claim,
        borrower: nameById.get(claim.borrower) ?? claim.borrower,
      }));
      const zero = new Big(0);
      return {
        reserveAccounts,
        claims,
        totalReserves: reserveAccounts.reduce(
          (sum, account) => sum.plus(account.balance),
          zero
        ),
        totalClaims: claims.reduce(
          (sum, claim) => sum.plus(claim.amount),
          zero
        ),
        equity: ownAccount?.balance ?? zero,
      };
    });
  }

  /**
   * The current reserve requirement, as the stored ratio (0.10 = 10%).
   * The central bank's dial on how much banks can lend; kept in its
   * books, seeded on first read so the Database view shows it, and read
   * by the commercial layer at every loan.
   */
  reserveRatio(): Effect.Effect<Big> {
    const settingRepo = this.db.settings;
    return Effect.gen(function* () {
      const stored = yield* Effect.promise(() =>
        settingRepo.get({ books: 'central-bank', key: RESERVE_RATIO_KEY })
      );
      if (stored !== undefined) return new Big(stored);
      yield* Effect.promise(() =>
        settingRepo.set({
          books: 'central-bank',
          key: RESERVE_RATIO_KEY,
          value: DEFAULT_RESERVE_RATIO.toString(),
        })
      );
      return DEFAULT_RESERVE_RATIO;
    });
  }

  /**
   * Sets the reserve requirement, from a percentage as typed ('2',
   * '10'). Zero is allowed — some real systems run without one. The new
   * ratio is checked at every following loan; a bank already below it
   * simply cannot lend until its reserves catch up. Prebuilt, not a
   * task: this dial is the teacher's lever. Returns the stored ratio.
   */
  setReserveRatio(input: {
    percent: string;
  }): Effect.Effect<Big, InvalidRateError> {
    const { percent } = input;
    const settingRepo = this.db.settings;
    return Effect.gen(function* () {
      // Interest rates may dip below zero; a reserve requirement cannot.
      const ratio = yield* parseRate(percent, new Big(0));
      yield* Effect.promise(() =>
        settingRepo.set({
          books: 'central-bank',
          key: RESERVE_RATIO_KEY,
          value: ratio.toString(),
        })
      );
      return ratio;
    });
  }

  /**
   * A default made official: the bank cannot (or will not) repay, so the
   * central bank deletes its claim and takes the loss on its own account
   * — which may go negative, and uniquely here that is survivable: a
   * central bank cannot go bust in the currency it issues. The forgiven
   * debt is the bank's gain — its liability vanishes, so its equity grows
   * by the same amount; the reserves the loan created stay in circulation.
   * Returns the written-off amount.
   */
  writeOffClaim(input: {
    bankId: number;
  }): Effect.Effect<Big, UnknownBankError | NoDebtToWriteOffError> {
    const { bankId } = input;
    const db = this.db;
    const claimRepo = this.db.claims;
    const requireBank = this.requireBank.bind(this);
    const requireOwnAccount = this.requireOwnAccount.bind(this);
    const requireBankOwnAccount = this.requireBankOwnAccount.bind(this);
    return Effect.gen(function* () {
      // TASK 2.3: Write off a bank's debt
      // TODO: implement task 2.3.
      throw new NotImplementedError('2.3');
      // ENDTASK 2.3
    });
  }

  /**
   * Checks a bank's reserve account covers an amount, or refuses with
   * the insufficient-reserves error every reserve-spending operation
   * shares. Task 2.2 writes this check out by hand once; later tasks
   * lean on the helper — the refusal still lives in the signature.
   */
  private requireReserves(
    bank: CommercialBank,
    reserve: Account,
    amount: Big
  ): Effect.Effect<void, InsufficientReservesError> {
    return Effect.gen(function* () {
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
   * A registered bank, or the refusal every bank-taking operation
   * shares. Task 2.1 writes this lookup out by hand once; every later
   * task leans on the helper — the check still lives in the signature.
   */
  private requireBank(
    bankId: number
  ): Effect.Effect<CommercialBank, UnknownBankError> {
    const commercialBankRepo = this.db.commercialBanks;
    return Effect.gen(function* () {
      const bank = yield* Effect.promise(() =>
        commercialBankRepo.get({ id: bankId })
      );
      if (!bank) return yield* Effect.fail(new UnknownBankError({ bankId }));
      return bank;
    });
  }

  /**
   * A bank's own account in the bank's books — where its interest
   * expense, central-bank payments, and forgiven debts land. Its absence
   * is corrupted state (opening the bank creates it), so it is a defect.
   */
  private requireBankOwnAccount(bank: CommercialBank): Effect.Effect<Account> {
    const accountRepo = this.db.accounts;
    return Effect.gen(function* () {
      const accounts = yield* Effect.promise(() =>
        accountRepo.list({ books: bank.id })
      );
      const ownAccount = accounts.find(candidate => candidate.personId === '');
      if (!ownAccount) {
        return yield* Effect.dieMessage(
          `${bank.name} has no own account in its books — reset the database if it was created before equity accounts existed.`
        );
      }
      return ownAccount;
    });
  }

  /**
   * The central bank's own account, where its interest income lives.
   * Unlike a bank's (opened with the bank), there is no opening moment
   * for the central bank itself, so the account is created by the first
   * operation that touches it — and only by operations: reads must never
   * write, or two screens refetching a fresh world would each create one
   * (balanceSheet reads the account raw instead).
   */
  private requireOwnAccount(): Effect.Effect<Account> {
    const accountRepo = this.db.accounts;
    return Effect.gen(function* () {
      const existing = yield* Effect.promise(() =>
        accountRepo.getByOwner({
          books: 'central-bank',
          owner: CENTRAL_BANK_NAME,
        })
      );
      if (existing) return existing;
      return yield* Effect.promise(() =>
        accountRepo.create({
          books: 'central-bank',
          owner: CENTRAL_BANK_NAME,
          number: randomAccountNumber(),
          personId: '',
        })
      );
    });
  }

  /**
   * A registered bank's reserve account. Its absence is corrupted state
   * (registration always opens one), so it is a defect, not a domain
   * error.
   */
  private requireReserveAccount(bank: CommercialBank): Effect.Effect<Account> {
    const accountRepo = this.db.accounts;
    return Effect.gen(function* () {
      const account = yield* Effect.promise(() =>
        accountRepo.getByOwner({ books: 'central-bank', owner: bank.name })
      );
      if (!account) {
        return yield* Effect.dieMessage(
          `${bank.name} is registered but has no reserve account.`
        );
      }
      return account;
    });
  }
}
