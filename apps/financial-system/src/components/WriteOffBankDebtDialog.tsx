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

// A bank's default made official: the central bank deletes its claim and
// its own equity takes the loss — possibly below zero, which only the
// central bank survives: it cannot go bust in the currency it issues.
// The forgiven debt is the bank's gain — its liability vanishes, so its
// equity grows by the same amount.

interface Bank {
  id: number;
  /** The name the bank is licensed under. */
  legalName: string;
}

interface ClaimRow {
  borrower: string;
  amount: string;
}

export function WriteOffBankDebtDialog({
  banks,
  claims,
  currency,
}: {
  banks: Bank[];
  /** The central bank's outstanding claims, keyed by bank id. */
  claims: ClaimRow[];
  currency: string;
}) {
  /** The chosen debtor's bank id, as the claims themselves key it. */
  const [borrowerId, setBorrowerId] = useState('');

  const debtors = claims.flatMap(claim => {
    const bank = banks.find(
      candidate => String(candidate.id) === claim.borrower
    );
    return bank ? [{ bank, amount: claim.amount }] : [];
  });
  const selected =
    debtors.find(debtor => String(debtor.bank.id) === borrowerId) ?? debtors[0];

  return (
    <OperationDialog
      trigger={
        <>
          <FileX size={16} /> Write off a bank's debt
        </>
      }
      title="Write off a bank's debt"
      description="Declares the claim lost: the central bank's equity absorbs the loss — it alone survives going negative — and the forgiven debt becomes the bank's gain."
      runLabel="Write off"
      onRun={async () => {
        if (!selected) throw new Error('There is no debt to write off yet.');
        const { writtenOff } = await api.centralBank.writeOffClaim.mutate({
          bankId: selected.bank.id,
        });
        const narration = `Wrote off ${selected.bank.legalName}'s debt of ${formatMoney(writtenOff)} ${currency} — the central bank's equity took the loss; the forgiven amount is the bank's gain.`;
        setBorrowerId('');
        return narration;
      }}
    >
      {debtors.length === 0 ? (
        <p className="text-sm text-muted">
          No bank owes the central bank anything — there is no debt to write
          off.
        </p>
      ) : (
        <Field label="bank">
          <Select
            value={selected ? String(selected.bank.id) : ''}
            onValueChange={setBorrowerId}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {debtors.map(debtor => (
                <SelectItem key={debtor.bank.id} value={String(debtor.bank.id)}>
                  {debtor.bank.legalName}{' '}
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
