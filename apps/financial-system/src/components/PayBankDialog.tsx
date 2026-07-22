import { Coins } from 'lucide-react';
import { useState } from 'react';

import { api } from '../api.ts';
import { formatMoney } from '../format.ts';
import { Field, INPUT_CLASS } from './Field.tsx';
import { OperationDialog } from './OperationDialog.tsx';

// The central bank spends: a payment from its own account — the policy-
// rate interest it earned — into a bank, crediting the bank's reserves
// and its equity (in reality: interest on reserves, services). Without
// this, banks could never repay more than was created.

interface Bank {
  id: number;
  name: string;
}

export function PayBankDialog({
  banks,
  currency,
}: {
  banks: Bank[];
  currency: string;
}) {
  const [bankId, setBankId] = useState('');
  const [amount, setAmount] = useState('');
  const selected = banks.find(bank => String(bank.id) === bankId) ?? banks[0];

  return (
    <OperationDialog
      trigger={
        <>
          <Coins size={16} /> Pay a bank
        </>
      }
      title="Pay a bank"
      description="Spends the central bank's own money — its interest income — into a bank, crediting the bank's reserves and its equity."
      runLabel="Pay"
      onRun={async () => {
        if (!selected) throw new Error('There is no bank to pay yet.');
        await api.centralBank.payBank.mutate({ bankId: selected.id, amount });
        const narration = `Paid ${formatMoney(amount)} ${currency} from the central bank's own account to ${selected.name} — its reserves and equity credited.`;
        setAmount('');
        return narration;
      }}
    >
      {banks.length === 0 ? (
        <p className="text-sm text-muted">
          No banks yet — open one on the Commercial Bank tab first.
        </p>
      ) : (
        <>
          <Field label="bank">
            <select
              className={INPUT_CLASS}
              value={bankId || String(selected?.id ?? '')}
              onChange={event => setBankId(event.target.value)}
            >
              {banks.map(bank => (
                <option key={bank.id} value={bank.id}>
                  {bank.name}
                </option>
              ))}
            </select>
          </Field>
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
