// The named errors the briefing tasks refuse with (0.4, 0.8). They are
// shaped exactly like the banking domain's errors (see
// packages/central-bank/src/bank-errors.ts): an Effect tagged error
// that becomes part of the method's return type, with a message that
// states the actual values.

import { Data } from 'effect';

/** An amount below zero, which no money amount may be. */
export class NegativeAmountError extends Data.TaggedError(
  'NegativeAmountError'
)<{ amount: string }> {
  override get message(): string {
    return `The amount ${this.amount} is negative — money amounts must not be.`;
  }
}

/** A legal name the register already holds a bank under. */
export class DuplicateBankNameError extends Data.TaggedError(
  'DuplicateBankNameError'
)<{ legalName: string }> {
  override get message(): string {
    return `A bank named '${this.legalName}' is already registered.`;
  }
}
