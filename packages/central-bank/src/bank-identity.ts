// The identities the central bank issues. As in reality, banks do not
// name themselves in the payment system: the central bank's register
// assigns each licensed bank its code (here: the register id, padded to
// four digits), and the BIC — the Bank Identifier Code every payment
// message routes by — is built from it. A bank's reserve account at the
// central bank is numbered by its BIC: the identity the license creates
// is the identity payments settle under. Banks issue only their own
// account numbers, one layer down (iban.ts builds IBANs from both).
//
// The country code comes from course.json: an explicit `countryCode`
// field when present, otherwise the first two letters of the country
// name, 'XX' when unset — deterministic in the grading sandbox, which
// has no course.json.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** Digits in a bank code — the `BBBB` inside IBANs and BICs. */
export const BANK_DIGITS = 4;

function loadCountryCode(): string {
  const file = path.resolve(import.meta.dirname, '../../..', 'course.json');
  try {
    if (!existsSync(file)) return 'XX';
    const config = JSON.parse(readFileSync(file, 'utf8')) as {
      country?: string;
      countryCode?: string;
    };
    const explicit = config.countryCode?.toUpperCase();
    if (explicit && /^[A-Z]{2}$/.test(explicit)) return explicit;
    const letters = (config.country ?? '')
      .toUpperCase()
      .replaceAll(/[^A-Z]/g, '');
    return letters.length >= 2 ? letters.slice(0, 2) : 'XX';
  } catch {
    return 'XX';
  }
}

/** The two-letter code of this country, used in IBANs and BICs. */
export const COUNTRY_CODE: string = loadCountryCode();

/** A bank's code in the payment system: its register id, four digits. */
export function bankCodeFor(bankId: number): string {
  return String(bankId).padStart(BANK_DIGITS, '0');
}

/** The BIC — Bank Identifier Code — that real payment messages name the
 *  sending and receiving institutions by: institution code (4), country
 *  (2), location (2). Simplified here: the institution code is the same
 *  4-digit bank code the IBAN carries, and every bank has one seat, so
 *  the location is a fixed 'XX'. */
export function bicFor(bankId: number, country: string = COUNTRY_CODE): string {
  return `${bankCodeFor(bankId)}${country}XX`;
}

/** The central bank's own BIC: bank code 0000, which no commercial bank
 *  can ever hold — register ids start at 1. Its own account is numbered
 *  by it, like every institution's account in its books at the top of
 *  the system. */
export const CENTRAL_BANK_BIC: string = bicFor(0);
