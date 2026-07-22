// Did a logged operation touch a given account? As the sender (ids in
// the input), as a loan or repayment target, or as the recipient — the
// IBAN in the input. Used by the expandable account rows on the User and
// Commercial Bank screens. The log lives in this browser's localStorage
// — the operator's trace, not a stored bank statement.

import type { CallLogEntry } from './call-log.ts';

export interface AccountRef {
  bankId: number;
  accountId: number;
  iban: string;
}

export function concernsAccount(
  entry: CallLogEntry,
  account: AccountRef
): boolean {
  if (typeof entry.input !== 'object' || entry.input === null) return false;
  const input = entry.input as Record<string, unknown>;
  if (
    input.fromBankId === account.bankId &&
    input.fromAccountId === account.accountId
  ) {
    return true;
  }
  if (
    input.bankId === account.bankId &&
    input.accountId === account.accountId
  ) {
    return true;
  }
  return (
    typeof input.toIban === 'string' &&
    input.toIban.replaceAll(' ', '').toUpperCase() === account.iban
  );
}
