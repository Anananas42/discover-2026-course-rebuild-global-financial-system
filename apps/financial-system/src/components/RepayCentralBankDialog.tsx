import { Undo2 } from 'lucide-react';
import Big from 'big.js';
import { useState } from 'react';

import { api } from '../api.ts';
import { formatMoney } from '../format.ts';
import { Field, INPUT_CLASS } from './Field.tsx';
import { OperationDialog } from './OperationDialog.tsx';

interface Bank {
  id: number;
  name: string;
}

export function RepayCentralBankDialog({
  bank,
  currency,
}: {
  /** The bank currently selected on the screen — the borrower. */
  bank: Bank | undefined;
  currency: string;
}) {
  const [amount, setAmount] = useState('');

  return (
    <OperationDialog
      trigger={
        <>
          <Undo2 size={16} /> Repay the central bank
        </>
      }
      title="Repay the central bank"
      description="Destroys money: debits this bank's reserves and reduces the central bank's claim."
      runLabel="Repay"
      onRun={async () => {
        if (!bank) throw new Error('There is no bank to repay from yet.');
        const { remainingDebt } = await api.banks.repayCentralBank.mutate({
          bankId: bank.id,
          amount,
        });
        const repaid = `Repaid ${formatMoney(amount)} ${currency} to the central bank`;
        setAmount('');
        return new Big(remainingDebt).eq(0)
          ? `${repaid} — ${bank.name}'s debt is fully repaid.`
          : `${repaid} — ${bank.name} still owes ${formatMoney(remainingDebt)} ${currency}.`;
      }}
    >
      <Field label={`amount (${currency})`}>
        <input
          className={`${INPUT_CLASS} font-mono tabular-nums`}
          value={amount}
          onChange={event => setAmount(event.target.value)}
          placeholder="0"
        />
      </Field>
    </OperationDialog>
  );
}
