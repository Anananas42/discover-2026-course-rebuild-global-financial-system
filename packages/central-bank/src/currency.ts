// The currency of this country: a ticker and the number of decimal places
// (CZK has 2 — cents; Japanese yen has 0). Chosen once in the guide and
// persisted to course.json; loaded here with a fallback so tests and the
// grading sandbox behave the same everywhere.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface Currency {
  code: string;
  decimals: number;
}

export const CZK: Currency = { code: 'CZK', decimals: 2 };

/** Reads the configured currency from course.json; CZK when unset. */
export function loadCurrency(): Currency {
  const file = path.resolve(import.meta.dirname, '../../..', 'course.json');
  try {
    if (!existsSync(file)) return CZK;
    const config = JSON.parse(readFileSync(file, 'utf8')) as {
      currency?: string;
      decimals?: number;
    };
    if (!config.currency) return CZK;
    return {
      code: config.currency,
      decimals: Number.isInteger(config.decimals) ? Number(config.decimals) : 2,
    };
  } catch {
    return CZK;
  }
}

/** The currency in effect for this country. */
export const CURRENCY: Currency = loadCurrency();
