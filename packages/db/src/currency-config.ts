// Reads the currency decimal places from course.json — needed here to size
// the minor storage unit: 2 for CZK (cents), 0 for JPY. Falls back to 2
// when unset. Choose the currency once — changing decimals reinterprets
// amounts already stored.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export function currencyDecimals(): number {
  const file = path.resolve(import.meta.dirname, '../../..', 'course.json');
  try {
    if (!existsSync(file)) return 2;
    const config = JSON.parse(readFileSync(file, 'utf8')) as {
      decimals?: number;
    };
    return Number.isInteger(config.decimals) ? Number(config.decimals) : 2;
  } catch {
    return 2;
  }
}
