import Big from 'big.js';
import { Banknote } from 'lucide-react';
import { useState } from 'react';

import { api } from '../api.ts';
import { formatMoney } from '../format.ts';
import { Field, INPUT_CLASS } from './Field.tsx';
import { OperationDialog } from './OperationDialog.tsx';

interface Bank {
  id: number;
  name: string;
}

export function LendToBankDialog({
  banks,
  currency,
  policyRate,
}: {
  banks: Bank[];
  currency: string;
  /** The policy rate, as a ratio string ('0.05' = 5%). */
  policyRate: string;
}) {
  const [bankId, setBankId] = useState('');
  const [amount, setAmount] = useState('');
  const selected = banks.find(bank => String(bank.id) === bankId) ?? banks[0];
  const percent = `${new Big(policyRate).times(100).toString()}%`;

  return (
    <OperationDialog
      trigger={
        <>
          <Banknote size={16} /> Lend to a bank
        </>
      }
      title="Lend to a bank"
      description={`Creates money: credits the bank's reserves and records a claim of the amount plus ${percent} interest — the central bank interest rate — its income and the borrowing bank's expense.`}
      runLabel="Lend"
      onRun={async () => {
        if (!selected) throw new Error('There is no bank to lend to yet.');
        const { totalDebt } = await api.centralBank.lend.mutate({
          bankId: selected.id,
          amount,
        });
        setAmount('');
        return `Lent ${formatMoney(amount)} ${currency} to ${selected.name} — reserves credited; with ${percent} interest, it now owes ${formatMoney(totalDebt)} ${currency}.`;
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
