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
// the guide calls it (policy-rate.ts — stored in the central bank's own
// database, set by the central banker, applied to new loans only): the
// claim is the amount plus interest, the interest is the central bank's
// income — credited to its own account, its equity — and the same
// interest is the borrowing bank's expense. The central bank spends its
// income back into the system with `payToBank` (in reality: interest on
// reserves, salaries), which is the only way banks can ever repay more
// than was created.
//
// Conventions for this package:
// - State lives in the central bank's own database, behind the prepared
//   `CentralBankDb` handle (@banks/db) — the only database this code can
//   reach. The handle only reads and writes rows; every check and
//   guarantee is the job of the code here. No SQL is ever written in
//   this package.
// - Other institutions' data is out of reach, as in the real world.
//   When an operation changes how much money a bank itself has, the
//   central bank sends the bank a notice (bank-notice.ts) and the bank
//   records its own side, in its own database.
// - Every public method takes one `input` object, and so does every
//   repo call: a call site names every field it passes, so nothing can
//   be swapped silently — and the wire, the log, and the code all show
//   the same named fields.
// - Read and check first, then write. A single write is atomic on its
//   own; a step with more than one write commits them in one
//   `centralBankDb.transaction(...)` block, so a crash can never leave
//   half an operation recorded.
// - Methods return `Effect.Effect<Result, PossibleErrors>`: the signature
//   states what a method returns and every way it can fail. Inside a
//   method, other methods are called with `yield*` and failures are
//   reported with `yield* Effect.fail(...)`.
// - Claims key the borrower by id — the bank id here, the personal id at
//   the commercial layer; balance sheets resolve display names.

import Big from 'big.js';
import { Effect } from 'effect';

import type { CentralBankDb } from '@banks/db/central-bank-db.ts';
import type { CentralBankAccount } from '@banks/db/repos/central-bank-account-repo.ts';
import type { Claim } from '@banks/db/repos/claim-repo.ts';
import type { CommercialBank } from '@banks/db/repos/commercial-bank-repo.ts';

import { bicFor, CENTRAL_BANK_BIC } from './bank-identity.ts';
import type { CentralBankApi } from './central-bank-api.ts';
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
import type { LicensedBanks } from './bank-notice.ts';
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
  reserveAccounts: CentralBankAccount[];
  /** Assets: outstanding claims on the banks. The raw table keys the
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

export class CentralBank implements CentralBankApi {
  private centralBankDb: CentralBankDb;
  /** The licensed commercial banks' side of the system — the channel
   *  notices travel through. The commercial layer wires itself in when
   *  it starts (see connectCommercialBanks); the central bank never
   *  holds a bank's database. */
  private commercialBanks: LicensedBanks | undefined;

  constructor(centralBankDb: CentralBankDb) {
    this.centralBankDb = centralBankDb;
  }

  /** Called by the commercial layer as it starts: the commercial banks
   *  join the central bank's settlement network and can receive
   *  notices. */
  connectCommercialBanks(commercialBanks: LicensedBanks): void {
    this.commercialBanks = commercialBanks;
  }

  /** The notice channel, or a hard stop when the system was wired
   *  without its commercial layer — a bootstrap bug, not a domain error. */
  private connectedCommercialBanks(): LicensedBanks {
    if (!this.commercialBanks) {
      throw new Error(
        'No commercial-bank layer is connected — construct CommercialBanks before running central bank operations.'
      );
    }
    return this.commercialBanks;
  }

  /**
   * Licenses a new bank: registers it and opens its reserve account here
   * at the central bank (the task, recordNewBank), then the license
   * lands at the bank and its own systems come online — its database,
   * with its own account in it (the bank's side, prebuilt). Tidies the
   * name on the way in: spaces around it are ignored, a blank one is
   * refused.
   */
  registerBank(input: {
    name: string;
  }): Effect.Effect<
    CommercialBank,
    InvalidBankNameError | DuplicateBankNameError
  > {
    const commercialBanks = this.connectedCommercialBanks();
    const recordNewBank = this.recordNewBank.bind(this);
    const name = input.name.trim();
    return Effect.gen(function* () {
      if (name === '') {
        return yield* Effect.fail(
          new InvalidBankNameError({
            name: input.name,
            reason: 'must not be empty',
          })
        );
      }
      const bank = yield* recordNewBank({ name });
      yield* commercialBanks.connectBank({ bankId: bank.id, name: bank.name });
      return bank;
    });
  }

  /**
   * The central bank's own records of a licensing: the bank's row in the
   * register and its reserve account. Only this institution's database —
   * what happens at the bank itself is the bank's job. The name arrives
   * already tidied: no spaces around it, never blank (registerBank's
   * job).
   */
  private recordNewBank(input: {
    name: string;
  }): Effect.Effect<
    CommercialBank,
    InvalidBankNameError | DuplicateBankNameError
  > {
    const { name } = input;
    const centralBankDb = this.centralBankDb;
    return Effect.gen(function* () {
      // TASK 1.1: License a new commercial bank
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
   * expense — which the bank records itself, in its own database, when
   * the notice reaches it (a fresh bank is in the red until it earns by
   * lending on). interestOn (policy-rate.ts) computes the interest.
   * Returns the bank's total debt after the loan.
   */
  lendToBank(input: {
    bankId: number;
    amount: Big;
  }): Effect.Effect<Big, UnknownBankError | InvalidAmountError> {
    const { bankId, amount } = input;
    const centralBankDb = this.centralBankDb;
    const commercialBanks = this.connectedCommercialBanks();
    const requireReserveAccount = this.requireReserveAccount.bind(this);
    const requireOwnAccount = this.requireOwnAccount.bind(this);
    const policyRate = this.policyRate.bind(this);
    return Effect.gen(function* () {
      // TASK 2.2: Lend to a bank
      // TODO: implement task 2.2.
      throw new NotImplementedError('2.2');
      // ENDTASK 2.2
    });
  }

  /**
   * The current policy rate, as the stored ratio (0.05 = 5%). Kept in
   * the central bank's own database; the default is seeded on first
   * read, so the Database view always shows the live value.
   */
  policyRate(): Effect.Effect<Big> {
    const centralBankDb = this.centralBankDb;
    return Effect.gen(function* () {
      const stored = yield* Effect.promise(() =>
        centralBankDb.settings.get({ key: POLICY_RATE_KEY })
      );
      if (stored !== undefined) return new Big(stored);
      yield* Effect.promise(() =>
        centralBankDb.settings.set({
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
    const centralBankDb = this.centralBankDb;
    return Effect.gen(function* () {
      // TASK 2.5: Set the central bank interest rate
      // TODO: implement task 2.5.
      throw new NotImplementedError('2.5');
      // ENDTASK 2.5
    });
  }

  /**
   * The central bank spends: pays from its own account — the interest
   * income it earned — into a bank, crediting the bank's reserves here
   * and, through the notice, the bank's own account there (in reality:
   * interest on reserves, services). This is how the central bank's
   * income returns to the system; without it, banks could never repay
   * more than was created. Refusal messages state the numbers to the
   * currency's decimal places — CURRENCY (currency.ts) carries them.
   */
  payToBank(input: {
    bankId: number;
    amount: Big;
  }): Effect.Effect<
    void,
    UnknownBankError | InvalidAmountError | InsufficientCentralBankFundsError
  > {
    const { bankId, amount } = input;
    const centralBankDb = this.centralBankDb;
    const commercialBanks = this.connectedCommercialBanks();
    const requireBank = this.requireBank.bind(this);
    const requireReserveAccount = this.requireReserveAccount.bind(this);
    const requireOwnAccount = this.requireOwnAccount.bind(this);
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
    const centralBankDb = this.centralBankDb;
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
    const centralBankDb = this.centralBankDb;
    const requireBank = this.requireBank.bind(this);
    const requireReserveAccount = this.requireReserveAccount.bind(this);
    return Effect.gen(function* () {
      // TASK 2.3: Receive a repayment
      // TODO: implement task 2.3.
      throw new NotImplementedError('2.3');
      // ENDTASK 2.3
    });
  }

  /** The central bank's balance sheet: reserve accounts, claims, and its
   *  own account's balance (the equity), listed apart from the banks'.
   *  Claims are keyed by bank id in the raw table; here each carries the
   *  bank's name as label. A read never writes: before the first
   *  operation creates the own account, equity is simply zero. */
  balanceSheet(): Effect.Effect<CentralBankBalanceSheet> {
    const centralBankDb = this.centralBankDb;
    return Effect.gen(function* () {
      const ownAccount = yield* Effect.promise(() =>
        centralBankDb.accounts.getByOwner({ owner: CENTRAL_BANK_NAME })
      );
      const accounts = yield* Effect.promise(() =>
        centralBankDb.accounts.list()
      );
      const reserveAccounts = accounts.filter(
        account => account.id !== ownAccount?.id
      );
      const rawClaims = yield* Effect.promise(() =>
        centralBankDb.claims.list()
      );
      const banks = yield* Effect.promise(() =>
        centralBankDb.commercialBanks.list()
      );
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
   * The register of licensed banks — public information: this is how the
   * rest of the system knows which banks exist, since only the central
   * bank holds the register itself.
   */
  listBanks(): Effect.Effect<CommercialBank[]> {
    const centralBankDb = this.centralBankDb;
    return Effect.promise(() => centralBankDb.commercialBanks.list());
  }

  /**
   * One licensed bank from the register, or the refusal every
   * bank-taking operation shares — the lookup the rest of the system
   * asks the central bank for.
   */
  findBank(input: {
    bankId: number;
  }): Effect.Effect<CommercialBank, UnknownBankError> {
    return this.requireBank(input.bankId);
  }

  /**
   * A bank's reserve balance — what a commercial bank asks the central
   * bank instead of reading its database, which nobody but the central
   * bank can. The commercial layer checks the reserve requirement and
   * settlement cover through this.
   */
  reserveBalance(input: {
    bankId: number;
  }): Effect.Effect<Big, UnknownBankError> {
    const requireBank = this.requireBank.bind(this);
    const requireReserveAccount = this.requireReserveAccount.bind(this);
    return Effect.gen(function* () {
      const bank = yield* requireBank(input.bankId);
      const reserve = yield* requireReserveAccount(bank);
      return reserve.balance;
    });
  }

  /**
   * The current reserve requirement, as the stored ratio (0.10 = 10%).
   * The central bank's dial on how much banks can lend; kept in its own
   * database, seeded on first read so the Database view shows it, and
   * read by the commercial layer at every loan.
   */
  reserveRatio(): Effect.Effect<Big> {
    const centralBankDb = this.centralBankDb;
    return Effect.gen(function* () {
      const stored = yield* Effect.promise(() =>
        centralBankDb.settings.get({ key: RESERVE_RATIO_KEY })
      );
      if (stored !== undefined) return new Big(stored);
      yield* Effect.promise(() =>
        centralBankDb.settings.set({
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
    const centralBankDb = this.centralBankDb;
    return Effect.gen(function* () {
      // Interest rates may dip below zero; a reserve requirement cannot.
      const ratio = yield* parseRate(percent, new Big(0));
      yield* Effect.promise(() =>
        centralBankDb.settings.set({
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
   * debt is the bank's gain — the notice carries the news, and the bank's
   * equity grows by the same amount in its own database; the reserves the
   * loan created stay in circulation. Returns the written-off amount.
   */
  writeOffClaim(input: {
    bankId: number;
  }): Effect.Effect<Big, UnknownBankError | NoDebtToWriteOffError> {
    const { bankId } = input;
    const centralBankDb = this.centralBankDb;
    const commercialBanks = this.connectedCommercialBanks();
    const requireBank = this.requireBank.bind(this);
    const requireOwnAccount = this.requireOwnAccount.bind(this);
    return Effect.gen(function* () {
      // TASK 2.4: Write off a bank's debt
      // TODO: implement task 2.4.
      throw new NotImplementedError('2.4');
      // ENDTASK 2.4
    });
  }

  /**
   * Checks a bank's reserve account covers an amount, or refuses with
   * the insufficient-reserves error every reserve-spending operation
   * shares. Task 2.3 writes this check out by hand once; later tasks
   * lean on the helper — the refusal still lives in the signature.
   */
  private requireReserves(
    bank: CommercialBank,
    reserve: CentralBankAccount,
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
   * shares. Task 2.2 writes this lookup out by hand once; every later
   * task leans on the helper — the check still lives in the signature.
   */
  private requireBank(
    bankId: number
  ): Effect.Effect<CommercialBank, UnknownBankError> {
    const centralBankDb = this.centralBankDb;
    return Effect.gen(function* () {
      const bank = yield* Effect.promise(() =>
        centralBankDb.commercialBanks.get({ id: bankId })
      );
      if (!bank) return yield* Effect.fail(new UnknownBankError({ bankId }));
      return bank;
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
  private requireOwnAccount(): Effect.Effect<CentralBankAccount> {
    const centralBankDb = this.centralBankDb;
    return Effect.gen(function* () {
      const existing = yield* Effect.promise(() =>
        centralBankDb.accounts.getByOwner({ owner: CENTRAL_BANK_NAME })
      );
      if (existing) return existing;
      return yield* Effect.promise(() =>
        centralBankDb.accounts.create({
          owner: CENTRAL_BANK_NAME,
          number: CENTRAL_BANK_BIC,
        })
      );
    });
  }

  /**
   * A registered bank's reserve account. Its absence is corrupted state
   * (registration always opens one), so it is a defect, not a domain
   * error.
   */
  private requireReserveAccount(
    bank: CommercialBank
  ): Effect.Effect<CentralBankAccount> {
    const centralBankDb = this.centralBankDb;
    return Effect.gen(function* () {
      const account = yield* Effect.promise(() =>
        centralBankDb.accounts.getByOwner({ owner: bank.name })
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
