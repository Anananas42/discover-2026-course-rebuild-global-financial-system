import Big from 'big.js';
import { useState } from 'react';

import { Slider } from '@banks/shared/browser/ui/slider.tsx';

import { api } from '../api.ts';
import { INPUT_CLASS } from './Field.tsx';
import { OperationDialog } from './OperationDialog.tsx';
import { RATE_SLIDER, rateSliderValue, sliderPercent } from './rate-slider.ts';

// The central banker moves the rate — the announcement everyone hears on
// the news. Entered in percent, stored in the central bank's books, and
// charged on new loans only: existing claims keep the price they were
// made at, like a signed loan contract.

export function SetPolicyRateDialog({
  policyRate,
}: {
  /** The current policy rate, as a ratio string ('0.05' = 5%). */
  policyRate: string;
}) {
  const [percent, setPercent] = useState('');
  const current = new Big(policyRate).times(100).toString();

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
          What the central bank charges a bank that borrows from it.
          <span className="mt-1 block">
            The rate applies to new loans only. A loan that already exists keeps
            the rate it was made at.
          </span>
          <span className="mt-1 block">
            Currently {current}%: a bank that borrows 1000 owes the central bank{' '}
            {new Big(policyRate).plus(1).times(1000).round(2).toString()} back.
          </span>
        </>
      }
      runLabel="Set"
      onRun={async () => {
        const result = await api.centralBank.setPolicyRate.mutate({ percent });
        const announced = new Big(result.policyRate).times(100).toString();
        setPercent('');
        return `Set the central bank interest rate to ${announced}% — every new loan to a bank will carry it.`;
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
