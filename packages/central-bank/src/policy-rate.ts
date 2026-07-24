// The policy rate: the interest the central bank charges on the loans
// that create reserves — the rate everyone hears about on the news. The
// guide and the workbench call it the central bank interest rate: the
// same rate, in plain words; "policy rate" is its professional name. It
// is a lever, not a constant of the world: the central banker sets it
// (stored in the central bank's own database), and each loan carries the rate
// valid at the moment it is made — existing claims never reprice. A bank
// borrows at the policy rate and lends to clients at its own higher
// rate; the spread is the bank's business.
//
// Simplified on purpose: a flat markup owed from the moment of the loan,
// not a yearly rate. The real Czech central bank steers the economy by
// moving its two-week repo rate in basis-point steps (and rates elsewhere
// have even gone negative); here moving the rate teaches where it sits in
// the machine, not a macro model of why it moves.

import Big from 'big.js';
import { Effect } from 'effect';

import { InvalidRateError } from './bank-errors.ts';
import { CURRENCY } from './currency.ts';

/** The rate a freshly reset world starts with: 5%. */
export const DEFAULT_POLICY_RATE = new Big('0.05');

/** The key the rate is stored under in the central bank's settings. */
export const POLICY_RATE_KEY = 'policy-rate';

/**
 * Parses a rate typed as a percentage ('5', '4.75') into the ratio the
 * settings row stores ('0.05'): a number from -5 to 100 in steps of a hundredth
 * of a percent — one basis point, the unit rate moves are announced in.
 * Slightly negative is allowed: real central banks have charged banks for
 * parking money (Japan, the euro area, Switzerland). Shared with the
 * commercial layer, whose lending rates parse the same. A caller whose
 * rate cannot go negative passes its own floor (the reserve requirement).
 */
export function parseRate(
  percent: string,
  floor: Big = new Big(-5)
): Effect.Effect<Big, InvalidRateError> {
  return Effect.gen(function* () {
    let value: Big;
    try {
      value = new Big(percent.trim());
    } catch {
      return yield* Effect.fail(
        new InvalidRateError({ rate: percent, reason: 'not a number' })
      );
    }
    if (value.lt(floor)) {
      return yield* Effect.fail(
        new InvalidRateError({
          rate: percent,
          reason: floor.eq(0)
            ? 'must not be negative'
            : `must be at least ${floor.toString()}`,
        })
      );
    }
    if (value.gt(100)) {
      return yield* Effect.fail(
        new InvalidRateError({ rate: percent, reason: 'must be at most 100' })
      );
    }
    if (!value.round(2).eq(value)) {
      return yield* Effect.fail(
        new InvalidRateError({
          rate: percent,
          reason: 'the finest step is 0.01 percent — one basis point',
        })
      );
    }
    return value.div(100);
  });
}

/** The interest on a loan at the given rate, rounded to what the
 *  currency can represent. Shared with the commercial layer. */
export function interestOn(amount: Big, rate: Big): Big {
  return amount.times(rate).round(CURRENCY.decimals);
}
