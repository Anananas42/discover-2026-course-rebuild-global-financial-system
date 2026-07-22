// Errors of the banking domain. Each domain error is an Effect tagged
// error (Data.TaggedError), which makes it part of the method's return
// type:
//   Effect.Effect<Transaction, InvalidAmountError | InsufficientReservesError>
// The signature therefore documents exactly which failures a method can
// produce. Messages are descriptive and state the actual numbers — they
// are the primary feedback channel, in tests and in the financial
// system's toasts alike.

import { Data } from 'effect';

import { CURRENCY } from './currency.ts';

/** A money amount that is not a valid, positive, representable value. */
export class InvalidAmountError extends Data.TaggedError('InvalidAmountError')<{
  amount: string;
  reason: string;
}> {
  override get message(): string {
    return `Amount '${this.amount}' is invalid: ${this.reason}.`;
  }
}

export class InvalidBankNameError extends Data.TaggedError(
  'InvalidBankNameError'
)<{ name: string; reason: string }> {
  override get message(): string {
    return `Bank name '${this.name}' is invalid: ${this.reason}.`;
  }
}

export class DuplicateBankNameError extends Data.TaggedError(
  'DuplicateBankNameError'
)<{ name: string }> {
  override get message(): string {
    return `A bank named '${this.name}' is already registered.`;
  }
}

export class UnknownBankError extends Data.TaggedError('UnknownBankError')<{
  bankId: number;
}> {
  override get message(): string {
    return `No bank with id ${this.bankId} is registered.`;
  }
}

export class SameBankError extends Data.TaggedError('SameBankError')<{
  bankId: number;
}> {
  override get message(): string {
    return `Cannot transfer reserves from a bank to itself.`;
  }
}

export class InsufficientReservesError extends Data.TaggedError(
  'InsufficientReservesError'
)<{ bank: string; balance: string; requested: string }> {
  override get message(): string {
    return (
      `${this.bank} holds ${this.balance} ${CURRENCY.code} in reserves — ` +
      `cannot transfer ${this.requested} ${CURRENCY.code}.`
    );
  }
}

/** An interest rate that is not a representable percentage — used at
 *  every layer where rates are set. */
export class InvalidRateError extends Data.TaggedError('InvalidRateError')<{
  rate: string;
  reason: string;
}> {
  override get message(): string {
    return `Rate '${this.rate}%' is invalid: ${this.reason}.`;
  }
}

/** The central bank spends only what it has earned — its own account
 *  cannot go negative here (real central banks can and do run negative
 *  equity; that subtlety is out of scope). */
export class InsufficientCentralBankFundsError extends Data.TaggedError(
  'InsufficientCentralBankFundsError'
)<{ balance: string; requested: string }> {
  override get message(): string {
    return (
      `The central bank's own account holds ${this.balance} ${CURRENCY.code} — ` +
      `cannot pay ${this.requested} ${CURRENCY.code}.`
    );
  }
}

/** Writing off a debt that does not exist — used at every layer where
 *  loans exist. */
export class NoDebtToWriteOffError extends Data.TaggedError(
  'NoDebtToWriteOffError'
)<{ borrower: string }> {
  override get message(): string {
    return `${this.borrower} owes nothing — there is no debt to write off.`;
  }
}

/** Repaying more than is owed — used at every layer where loans exist. */
export class RepaymentExceedsDebtError extends Data.TaggedError(
  'RepaymentExceedsDebtError'
)<{ borrower: string; debt: string; requested: string }> {
  override get message(): string {
    return (
      `${this.borrower} owes ${this.debt} ${CURRENCY.code} — ` +
      `cannot repay ${this.requested} ${CURRENCY.code}.`
    );
  }
}

/**
 * Thrown by generated task stubs that have not been implemented yet.
 *
 * The message format is part of the course machinery: the tooling parses
 * "Task <id> is not implemented." to tell "blocked by an earlier task"
 * apart from a real failure. Change it only together with the generator
 * and the dashboard server.
 */
export class NotImplementedError extends Error {
  constructor(task: string) {
    super(`Task ${task} is not implemented.`);
  }
}
