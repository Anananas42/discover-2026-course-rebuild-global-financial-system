import { Undo2 } from 'lucide-react';
import Big from 'big.js';
import { useState } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@banks/shared/browser/ui/select.tsx';

import { api } from '../api.ts';
import { formatIban, formatMoney } from '../format.ts';
import { Field, INPUT_CLASS } from './Field.tsx';
import { OperationDialog } from './OperationDialog.tsx';

// Repayment comes out of the account that owes — pick which of your
// loans to pay down when you have several.

interface PersonAccount {
  bankId: number;
  bankName: string;
  accountId: number;
  owner: string;
  iban: string;
  debt: string;
}

export function RepayLoanDialog({
  accounts,
  currency,
}: {
  /** The selected person's accounts; only indebted ones can repay. */
  accounts: PersonAccount[];
  currency: string;
}) {
  const [fromIban, setFromIban] = useState('');
  const [amount, setAmount] = useState('');
  const indebted = accounts.filter(account => new Big(account.debt).gt(0));
  const from =
    indebted.find(account => account.iban === fromIban) ?? indebted[0];

  return (
    <OperationDialog
      trigger={
        <>
          <Undo2 size={16} /> Repay your loan
        </>
      }
      title="Repay your loan"
      description="Pays your debt down from your account balance — repayment destroys the deposit again."
      runLabel="Repay"
      onRun={async () => {
        if (!from) throw new Error('There is no loan to repay.');
        const { remainingDebt } = await api.user.repayLoan.mutate({
          bankId: from.bankId,
          accountId: from.accountId,
          amount,
        });
        const repaid = `Repaid ${formatMoney(amount)} ${currency}`;
        setAmount('');
        return new Big(remainingDebt).eq(0)
          ? `${repaid} — your loan at ${from.bankName} is fully repaid.`
          : `${repaid} — you still owe ${formatMoney(remainingDebt)} ${currency} at ${from.bankName}.`;
      }}
    >
      {indebted.length === 0 ? (
        <p className="text-sm text-muted">You have no loan to repay.</p>
      ) : (
        <>
          <Field label="loan">
            <Select value={from?.iban ?? ''} onValueChange={setFromIban}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {indebted.map(account => (
                  <SelectItem key={account.iban} value={account.iban}>
                    {account.bankName} — owes {formatMoney(account.debt)}{' '}
                    {currency}{' '}
                    <span className="font-mono text-muted tabular-nums">
                      ({formatIban(account.iban)})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
