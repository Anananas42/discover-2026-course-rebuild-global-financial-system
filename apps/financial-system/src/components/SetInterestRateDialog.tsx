import Big from 'big.js';
import { useState } from 'react';

import { Slider } from '@banks/shared/browser/ui/slider.tsx';

import { api } from '../api.ts';
import { INPUT_CLASS } from './Field.tsx';
import { OperationDialog } from './OperationDialog.tsx';
import { RATE_SLIDER, rateSliderValue, sliderPercent } from './rate-slider.ts';

// The bank prices its own loans. A gauge in the screen header: the pill
// showing the current rate is the control that changes it. Entered in
// percent, stored in this bank's own database, and charged on new loans only —
// existing claims keep the price they were made at. A bank prices above
// the central bank's policy rate; the spread is its business.

interface Bank {
  id: number;
  name: string;
}

export function SetInterestRateDialog({
  bank,
  interestRate,
}: {
  /** The bank currently selected on the screen — the price setter. */
  bank: Bank;
  /** The bank's current lending rate, as a ratio string ('0.10' = 10%). */
  interestRate: string;
}) {
  const [percent, setPercent] = useState('');
  const current = new Big(interestRate).times(100).toString();

  return (
    <OperationDialog
      gauge
      trigger={
        <>
          interest rate{' '}
          <span className="font-mono font-semibold tabular-nums">
            {current}%
          </span>
        </>
      }
      triggerLabel="Set the interest rate"
      title="Set the interest rate"
      description={
        <>
          What this bank charges a client who borrows from it.
          <span className="mt-1 block">
            The rate applies to new loans only. A loan that already exists keeps
            the rate it was made at.
          </span>
          <span className="mt-1 block">
            Currently {current}%: a client who borrows 1000 owes the bank{' '}
            {new Big(interestRate).plus(1).times(1000).round(2).toString()}{' '}
            back.
          </span>
        </>
      }
      runLabel="Set"
      onRun={async () => {
        const result = await api.banks.setInterestRate.mutate({
          bankId: bank.id,
          percent,
        });
        const announced = new Big(result.interestRate).times(100).toString();
        setPercent('');
        return `Set ${bank.name}'s interest rate to ${announced}% — every new client loan will carry it.`;
      }}
    >
      <div>
        <span className="mb-1 block text-xs text-muted">interest rate (%)</span>
        <Slider
          {...RATE_SLIDER}
          aria-label="interest rate (%)"
          value={[rateSliderValue(percent, current)]}
          onValueChange={([next = 0]) => setPercent(sliderPercent(next))}
        />
        <input
          className={`${INPUT_CLASS} mt-2 font-mono tabular-nums`}
          value={percent}
          onChange={event => setPercent(event.target.value)}
          placeholder={current}
          aria-label="interest rate (%), typed precisely"
        />
      </div>
    </OperationDialog>
  );
}
