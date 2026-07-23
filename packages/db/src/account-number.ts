// Account numbers are issued by the account's own bank at opening —
// random, not sequential, so a bank's records reveal nothing about how
// many accounts it has and nobody can enumerate another bank's clients.
// Ten digits, stored as text (leading zeros are significant).

import { randomInt } from 'node:crypto';

export const ACCOUNT_NUMBER_DIGITS = 10;

export function randomAccountNumber(): string {
  return String(randomInt(0, 10 ** ACCOUNT_NUMBER_DIGITS)).padStart(
    ACCOUNT_NUMBER_DIGITS,
    '0'
  );
}
