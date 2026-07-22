import Big from 'big.js';

// The two interest-rate dials share one scale: -5% to 30% in 0.1 steps.
// Slightly negative is real — the domain allows it down to -5 (see
// packages/central-bank/src/policy-rate.ts).

export const RATE_SLIDER = { min: -5, max: 30, step: 0.1 };

/** The slider's position: what is typed when it parses, else the current
 *  rate — so a half-typed value never makes the slider jump. */
export function rateSliderValue(percent: string, current: string): number {
  const typed = Number(percent);
  return percent.trim() !== '' && Number.isFinite(typed)
    ? typed
    : Number(current);
}

/** A slider step as the percent string the form submits: one decimal,
 *  cleaned of float artifacts (-5 + k × 0.1 in floats is not exact). */
export function sliderPercent(value: number): string {
  return new Big(value).round(1).toString();
}
