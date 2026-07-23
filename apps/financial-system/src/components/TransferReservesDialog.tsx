import { ArrowRightLeft } from 'lucide-react';
import { useState } from 'react';

import { api } from '../api.ts';
import { formatMoney } from '../format.ts';
import { Field, INPUT_CLASS } from './Field.tsx';
import { OperationDialog } from './OperationDialog.tsx';

interface Bank {
  id: number;
  name: string;
}

export function TransferReservesDialog({
  banks,
  currency,
}: {
  banks: Bank[];
  currency: string;
}) {
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const from = banks.find(bank => String(bank.id) === fromId) ?? banks[0];
  const to =
    banks.find(bank => String(bank.id) === toId) ?? banks[1] ?? banks[0];

  // Picking the other side's bank swaps the two instead of duplicating it.
  const selectFrom = (next: string) => {
    if (from && to && next === String(to.id)) setToId(String(from.id));
    setFromId(next);
  };
  const selectTo = (next: string) => {
    if (from && to && next === String(from.id)) setFromId(String(to.id));
    setToId(next);
  };

  const bankSelect = (
    value: string,
    fallback: Bank | undefined,
    onChange: (next: string) => void
  ) => (
    <select
      className={INPUT_CLASS}
      value={value || String(fallback?.id ?? '')}
      onChange={event => onChange(event.target.value)}
    >
      {banks.map(bank => (
        <option key={bank.id} value={bank.id}>
          {bank.name}
        </option>
      ))}
    </select>
  );

  return (
    <OperationDialog
      debug
      trigger={
        <>
          <ArrowRightLeft size={16} /> Transfer reserves
        </>
      }
      title="Transfer reserves"
      description={
        <>
          Moves reserves from one bank to another with no payment behind the
          move — in the real world, reserves move only to settle payments.
          <span className="mt-1.5 block">
            Expect both banks&apos; balance sheets to stop balancing: one bank
            gained money, the other lost it, and neither bank&apos;s records say
            why.
          </span>
          <span className="mt-1.5 block">
            Transfer the same amount back to fix them.
          </span>
        </>
      }
      runLabel="Transfer"
      onRun={async () => {
        if (!from || !to)
          throw new Error('There are no banks to settle between yet.');
        await api.centralBank.transferReserves.mutate({
          fromBankId: from.id,
          toBankId: to.id,
          amount,
        });
        setAmount('');
        return `Moved ${formatMoney(amount)} ${currency} of reserves from ${from.name} to ${to.name}.`;
      }}
    >
      {banks.length < 2 ? (
        <p className="text-sm text-muted">
          Settlement needs two banks — open them on the Commercial Bank tab
          first.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="from">{bankSelect(fromId, from, selectFrom)}</Field>
            <Field label="to">{bankSelect(toId, to, selectTo)}</Field>
          </div>
          <Field label={`amount (${currency})`}>
            <input
              className={`${INPUT_CLASS} font-mono tabular-nums`}
              value={amount}
              onChange={event => setAmount(event.target.value)}
              placeholder="0"
            />
          </Field>
        </>
      )}
    </OperationDialog>
  );
}
