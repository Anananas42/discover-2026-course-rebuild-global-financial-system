// IBAN addressing: every client account has one, and it is the only thing
// a sender needs — the bank is encoded inside it, so the system (never
// the user) decides whether a transfer stays internal or crosses banks.
//
// The format is a simplified national IBAN: two country letters, two
// check digits, a 4-digit bank code (issued by the central bank's
// register — bank-identity.ts), a 10-digit account number (issued by the
// bank itself) — 18 characters. The check digits are the real thing,
// ISO 7064 mod 97-10, so a mistyped IBAN fails validation before it ever
// reaches an account. Digit arithmetic runs over strings, chunk by chunk
// — no floats, and nothing here touches money anyway.

import { Effect } from 'effect';

import {
  BANK_DIGITS,
  bankCodeFor,
  COUNTRY_CODE,
} from '@banks/central-bank/bank-identity.ts';

import { InvalidIbanError } from './commercial-bank-errors.ts';

const ACCOUNT_DIGITS = 10;
const IBAN_LENGTH = 2 + 2 + BANK_DIGITS + ACCOUNT_DIGITS;

/** Remainder of an arbitrarily long digit string modulo 97. */
function mod97(digits: string): number {
  let remainder = 0;
  for (const digit of digits) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder;
}

/** Letters become two-digit numbers (A=10 … Z=35), per ISO 13616. */
function toDigits(text: string): string {
  let out = '';
  for (const char of text) {
    out += /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char;
  }
  return out;
}

/** The IBAN of an account, check digits computed. The account number is
 *  the bank-issued random number, never an internal row id. */
export function ibanFor(
  bankId: number,
  accountNumber: string,
  country: string = COUNTRY_CODE
): string {
  const bban =
    bankCodeFor(bankId) + accountNumber.padStart(ACCOUNT_DIGITS, '0');
  const check = 98 - mod97(toDigits(`${bban}${country}00`));
  return `${country}${String(check).padStart(2, '0')}${bban}`;
}

export interface ParsedIban {
  country: string;
  bankId: number;
  accountNumber: string;
}

/**
 * Parses an IBAN as typed — spaces and lowercase are fine — and verifies
 * the check digits, so a typo is caught here, not at an account.
 */
export function parseIban(
  raw: string
): Effect.Effect<ParsedIban, InvalidIbanError> {
  return Effect.gen(function* () {
    const iban = raw.replaceAll(' ', '').toUpperCase();
    if (!/^[A-Z]{2}\d{16}$/.test(iban)) {
      return yield* Effect.fail(
        new InvalidIbanError({
          iban: raw,
          reason: `must be two letters followed by 16 digits (${IBAN_LENGTH} characters)`,
        })
      );
    }
    // ISO 7064: move the first four characters to the end; the whole
    // number must leave remainder 1 modulo 97.
    if (mod97(toDigits(iban.slice(4) + iban.slice(0, 4))) !== 1) {
      return yield* Effect.fail(
        new InvalidIbanError({
          iban: raw,
          reason: 'the check digits do not match — look for a typo',
        })
      );
    }
    return {
      country: iban.slice(0, 2),
      bankId: Number(iban.slice(4, 4 + BANK_DIGITS)),
      accountNumber: iban.slice(4 + BANK_DIGITS),
    };
  });
}
