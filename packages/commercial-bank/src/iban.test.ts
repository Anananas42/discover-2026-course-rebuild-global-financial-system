import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';

import { InvalidIbanError } from './commercial-bank-errors.ts';
import { COUNTRY_CODE } from '@banks/central-bank/bank-identity.ts';

import { ibanFor, parseIban } from './iban.ts';

describe('ibans', () => {
  it('packs the bank and account number into an 18-character IBAN and reads them back', async () => {
    const iban = ibanFor(1, '0087654321');
    expect(iban).toHaveLength(18);
    const parsed = await Effect.runPromise(parseIban(iban));
    expect(parsed).toEqual({
      country: COUNTRY_CODE,
      bankId: 1,
      accountNumber: '0087654321',
    });
  });

  it('accepts an IBAN typed with spaces and lowercase letters', async () => {
    const iban = ibanFor(2, '7');
    const sloppy = iban
      .toLowerCase()
      .replace(/(.{4})/g, '$1 ')
      .trim();
    const parsed = await Effect.runPromise(parseIban(sloppy));
    expect(parsed.bankId).toBe(2);
    expect(parsed.accountNumber).toBe('0000000007');
  });

  it('catches a one-digit typo through the check digits', async () => {
    const iban = ibanFor(1, '1');
    const lastDigit = Number(iban.at(-1));
    const typo = iban.slice(0, -1) + String((lastDigit + 1) % 10);
    const error = await Effect.runPromise(Effect.flip(parseIban(typo)));
    expect(error).toBeInstanceOf(InvalidIbanError);
    expect(error.message).toContain('check digits');
  });

  it('rejects text that is not an IBAN at all', async () => {
    for (const raw of ['', 'not an iban', 'XX12345', `${COUNTRY_CODE}12`]) {
      const error = await Effect.runPromise(Effect.flip(parseIban(raw)));
      expect(error).toBeInstanceOf(InvalidIbanError);
    }
  });
});
