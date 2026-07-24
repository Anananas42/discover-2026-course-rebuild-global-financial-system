import { Banknote } from 'lucide-react';
import { useState } from 'react';

import { api } from '../api.ts';
import { formatMoney } from '../format.ts';
import { Field, INPUT_CLASS } from './Field.tsx';
import { OperationDialog } from './OperationDialog.tsx';

// The bank spends: a payment from the bank's own account — the equity
// its interest income built up — to any IBAN in the country (salaries,
// dividends, rent). Same recipient rule as the user's payment form: one IBAN given
// out of band, the system decides internal vs. interbank.

interface Bank {
  id: number;
  name: string;
}

export function PayFromBankDialog({
  bank,
  currency,
}: {
  /** The bank currently selected on the screen — the payer. */
  bank: Bank | undefined;
  currency: string;
}) {
  const [toIban, setToIban] = useState('');
  const [amount, setAmount] = useState('');

  return (
    <OperationDialog
      trigger={
        <>
          <Banknote size={16} /> Pay from the bank's account
        </>
      }
      title="Pay from the bank's account"
      description="Spends the bank's own money — the interest it earned — to any IBAN in the country: salaries, dividends, rent. This is how a bank's income gets back into circulation."
      runLabel="Pay"
      onRun={async () => {
        if (!bank) {
          throw new Error('There is no bank to pay from yet.');
        }
        const receipt = await api.banks.pay.mutate({
          bankId: bank.id,
          toIban,
          amount,
        });
        const paid = `Paid ${formatMoney(amount)} ${currency} from ${bank.name}'s own account to ${receipt.recipient}`;
        setToIban('');
        setAmount('');
        return receipt.kind === 'interbank'
          ? `${paid} — interbank: settled reserves through the central bank.`
          : `${paid} — internal: booked inside ${bank.name}.`;
      }}
    >
      {!bank ? (
        <p className="text-sm text-muted">There is no bank yet.</p>
      ) : (
        <>
          <Field label="recipient IBAN">
            <input
              className={`${INPUT_CLASS} font-mono uppercase tabular-nums`}
              value={toIban}
              onChange={event => setToIban(event.target.value)}
              placeholder="XX00 0000 0000 0000 00"
            />
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
