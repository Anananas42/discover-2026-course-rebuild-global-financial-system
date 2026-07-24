import { FileX } from 'lucide-react';
import { useState } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@banks/shared/browser/ui/select.tsx';

import { api } from '../api.ts';
import { formatMoney } from '../format.ts';
import { Field } from './Field.tsx';
import { OperationDialog } from './OperationDialog.tsx';

// A default made official: the bank deletes its claim and its equity
// takes the loss — possibly below zero, which is what an insolvent bank
// looks like. The borrower's deposits are untouched: a default destroys
// the lender's asset, never the money.

interface Bank {
  id: number;
  name: string;
}

interface ClientAccountRow {
  owner: string;
  personId: string;
}

interface LoanRow {
  borrower: string;
  amount: string;
}

export function WriteOffLoanDialog({
  bank,
  accounts,
  loans,
  currency,
}: {
  /** The bank currently selected on the screen — the lender. */
  bank: Bank | undefined;
  /** The bank's client accounts — the names behind the personal ids. */
  accounts: ClientAccountRow[];
  /** The bank's outstanding loans, keyed by the borrower's personal id. */
  loans: LoanRow[];
  currency: string;
}) {
  const [personId, setPersonId] = useState('');

  const debtors = loans.map(loan => ({
    personId: loan.borrower,
    amount: loan.amount,
    name:
      accounts.find(account => account.personId === loan.borrower)?.owner ??
      loan.borrower,
  }));
  const selected =
    debtors.find(debtor => debtor.personId === personId) ?? debtors[0];

  return (
    <OperationDialog
      trigger={
        <>
          <FileX size={16} /> Write off a loan
        </>
      }
      title="Write off a loan"
      description="Declares the loan lost: the claim disappears and this bank's equity absorbs the loss — the borrower's deposits stay where they are."
      runLabel="Write off"
      onRun={async () => {
        if (!bank || !selected) {
          throw new Error('There is no loan to write off yet.');
        }
        const { writtenOff } = await api.banks.writeOffLoan.mutate({
          bankId: bank.id,
          personId: selected.personId,
        });
        const narration = `Wrote off ${selected.name}'s (${selected.personId}) debt of ${formatMoney(writtenOff)} ${currency} — ${bank.name}'s equity absorbed the loss; the deposits stay in circulation.`;
        setPersonId('');
        return narration;
      }}
    >
      {!bank || debtors.length === 0 ? (
        <p className="text-sm text-muted">
          Nobody owes this bank anything — there is no loan to write off.
        </p>
      ) : (
        <Field label="borrower">
          <Select value={selected?.personId ?? ''} onValueChange={setPersonId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {debtors.map(debtor => (
                <SelectItem key={debtor.personId} value={debtor.personId}>
                  <span className="font-mono tabular-nums">
                    {debtor.personId}
                  </span>{' '}
                  <span className="text-muted">|</span> {debtor.name}{' '}
                  <span className="text-muted">
                    (owes {formatMoney(debtor.amount)} {currency})
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
    </OperationDialog>
  );
}
