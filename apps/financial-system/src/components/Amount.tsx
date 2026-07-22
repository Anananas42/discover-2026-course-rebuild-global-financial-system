import { formatMoney } from '../format.ts';

// A money value as every panel renders it: mono, tabular, muted ticker.
// Negative amounts render in the danger color — "in the red", the one
// real-world color convention money has.

export function Amount({
  value,
  currency,
}: {
  value: string;
  currency: string;
}) {
  const negative = value.startsWith('-');
  return (
    <span
      className={`font-mono text-[13px] tabular-nums ${negative ? 'text-danger' : ''}`}
    >
      {formatMoney(value)} <span className="text-muted">{currency}</span>
    </span>
  );
}
