import Big from 'big.js';
import { useState } from 'react';

import { api } from '../api.ts';
import { Field, INPUT_CLASS } from './Field.tsx';
import { OperationDialog } from './OperationDialog.tsx';

// The central bank's dial on lending: the share of client deposits every
// bank must back with reserves held here. Checked whenever a bank lends,
// so raising it freezes over-extended banks until their reserves catch
// up; zero is allowed — some real systems run without a requirement.

export function SetReserveRatioDialog({
  reserveRatio,
}: {
  /** The current requirement, as a ratio string ('0.10' = 10%). */
  reserveRatio: string;
}) {
  const [percent, setPercent] = useState('');
  const current = new Big(reserveRatio).times(100).toString();

  return (
    <OperationDialog
      gauge
      trigger={
        <>
          reserve requirement{' '}
          <span className="font-mono font-semibold tabular-nums">
            {current}%
          </span>
        </>
      }
      triggerLabel="Set the reserve requirement"
      title="Set the reserve requirement"
      description={
        <>
          Every bank must hold reserves at the central bank worth at least this
          share of its client deposits.
          <span className="mt-1 block">
            This is the central bank's dial on how much banks can lend.
          </span>
          <span className="mt-1 block">
            {new Big(reserveRatio).eq(0)
              ? 'Currently 0% — banks may lend without holding any reserves.'
              : `Currently ${current}%: a bank with 1000 in reserves can hold up to ${new Big(1000).div(reserveRatio).round(2).toString()} in client deposits.`}
          </span>
        </>
      }
      runLabel="Set"
      onRun={async () => {
        const result = await api.centralBank.setReserveRatio.mutate({
          percent,
        });
        const ratio = new Big(result.reserveRatio);
        const announced = ratio.times(100).toString();
        setPercent('');
        return ratio.eq(0)
          ? `Set the reserve requirement to 0% — banks may now lend without holding any reserves.`
          : `Set the reserve requirement to ${announced}% — 1 of reserves now supports up to ${new Big(100).div(announced).round(2).toString()} of client deposits.`;
      }}
    >
      <Field label="reserve requirement (%)">
        <input
          className={`${INPUT_CLASS} font-mono tabular-nums`}
          value={percent}
          onChange={event => setPercent(event.target.value)}
          placeholder={current}
        />
      </Field>
    </OperationDialog>
  );
}
