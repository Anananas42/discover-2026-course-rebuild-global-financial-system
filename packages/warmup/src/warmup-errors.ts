// The mission briefing's one error, shaped exactly like the banking domain's
// (see packages/central-bank/src/bank-errors.ts): an Effect tagged error
// that becomes part of the method's return type, with a message that
// states the actual numbers.

import { Data } from 'effect';

/** An amount below zero, which no money amount may be. */
export class NegativeAmountError extends Data.TaggedError(
  'NegativeAmountError'
)<{ amount: string }> {
  override get message(): string {
    return `The amount ${this.amount} is negative — money amounts must not be.`;
  }
}
