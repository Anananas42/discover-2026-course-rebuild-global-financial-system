// Domain errors of the commercial-bank layer. Errors shared with the
// layer below — invalid amounts, unknown banks, repayment exceeding debt
// — are reused from @banks/central-bank; these are the failures that only
// exist once client accounts do.

import { Data } from 'effect';

import { CURRENCY } from '@banks/central-bank/currency.ts';

export class InvalidClientNameError extends Data.TaggedError(
  'InvalidClientNameError'
)<{ name: string; reason: string }> {
  override get message(): string {
    return `Client name '${this.name}' is invalid: ${this.reason}.`;
  }
}

export class UnknownPersonError extends Data.TaggedError('UnknownPersonError')<{
  personId: string;
}> {
  override get message(): string {
    return `No person with personal id ${this.personId} is known to any bank.`;
  }
}

export class UnknownAccountError extends Data.TaggedError(
  'UnknownAccountError'
)<{ bankId: number; account: string }> {
  override get message(): string {
    return `No account ${this.account} exists at bank ${this.bankId}.`;
  }
}

export class SameAccountError extends Data.TaggedError('SameAccountError')<{
  accountId: number;
}> {
  override get message(): string {
    return `Cannot send money from an account to itself.`;
  }
}

/** A payment order must come from the account's holder — the one check
 *  that binds the sender's identity to the account they spend from. */
export class NotAccountOwnerError extends Data.TaggedError(
  'NotAccountOwnerError'
)<{ personId: string; account: string }> {
  override get message(): string {
    return `Account ${this.account} does not belong to person ${this.personId || '(none)'}.`;
  }
}

export class InvalidIbanError extends Data.TaggedError('InvalidIbanError')<{
  iban: string;
  reason: string;
}> {
  override get message(): string {
    return `IBAN '${this.iban}' is invalid: ${this.reason}.`;
  }
}

export class MismatchedMessageError extends Data.TaggedError(
  'MismatchedMessageError'
)<{ toBic: string; toIban: string }> {
  override get message(): string {
    return `Message is inconsistent: the BIC ${this.toBic} and the IBAN ${this.toIban} name different banks.`;
  }
}

export class ForeignIbanError extends Data.TaggedError('ForeignIbanError')<{
  iban: string;
  country: string;
}> {
  override get message(): string {
    return `IBAN '${this.iban}' is from country ${this.country} — only domestic transfers are supported for now.`;
  }
}

export class ReserveRequirementError extends Data.TaggedError(
  'ReserveRequirementError'
)<{ bank: string; reserves: string; required: string; ratio: string }> {
  override get message(): string {
    return (
      `${this.bank} holds ${this.reserves} ${CURRENCY.code} in reserves, but this loan ` +
      `would require ${this.required} ${CURRENCY.code} — reserves must stay at least ` +
      `${this.ratio} of client deposits. Borrow reserves from the central bank first.`
    );
  }
}

export class InsufficientFundsError extends Data.TaggedError(
  'InsufficientFundsError'
)<{ owner: string; balance: string; requested: string }> {
  override get message(): string {
    return (
      `${this.owner}'s account holds ${this.balance} ${CURRENCY.code} — ` +
      `cannot pay ${this.requested} ${CURRENCY.code}.`
    );
  }
}
