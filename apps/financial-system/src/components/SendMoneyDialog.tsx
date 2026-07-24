import { ArrowRight, Send } from 'lucide-react';
import { useState } from 'react';

import { api } from '../api.ts';
import { formatMoney } from '../format.ts';
import type { PickerAccount } from './AccountPicker.tsx';
import { AccountPicker, useAccountSelection } from './AccountPicker.tsx';
import { Field, FieldGroup, INPUT_CLASS } from './Field.tsx';
import { OperationDialog } from './OperationDialog.tsx';

// The external payment form: the sender is picked person-then-account;
// the recipient is one IBAN you were given out of band — deliberately no
// directory here, a user does not have that view of the world. The bank
// is encoded in the IBAN, so the system decides whether the transfer
// stays internal or crosses banks (the toast reports which it was), and
// a typo fails on the check digits before any ledger is touched.

export function SendMoneyDialog({
  clients,
  defaultPersonId,
  currency,
}: {
  /** Every account in the country. */
  clients: PickerAccount[];
  /** The identity selected on the screen — the preselected sender. */
  defaultPersonId?: string;
  currency: string;
}) {
  const [toIban, setToIban] = useState('');
  const [amount, setAmount] = useState('');
  const from = useAccountSelection(clients, {
    preferredPersonId: defaultPersonId,
  });

  return (
    <OperationDialog
      trigger={
        <>
          <Send size={16} /> Send money
        </>
      }
      title="Send money"
      description={
        <>
          Transfers to any IBAN you were given — at any bank in the country.
          <span className="mt-1.5 block">
            When the IBAN belongs to another bank, the payment is two moves: the
            banks settle reserves at the central bank first, and only then does
            the client money move — two ledgers, one payment.
          </span>
        </>
      }
      runLabel="Send"
      wide
      onRun={async () => {
        if (!from.account) {
          throw new Error('There is no account to send from yet.');
        }
        const receipt = await api.user.sendMoney.mutate({
          personId: from.account.personId,
          fromBankId: from.account.bankId,
          fromAccountId: from.account.accountId,
          toIban,
          amount,
        });
        const sent = `Sent ${formatMoney(amount)} ${currency} to ${receipt.recipient}`;
        setToIban('');
        setAmount('');
        return receipt.kind === 'interbank'
          ? `${sent} — interbank: debited ${from.account.owner} at ${from.account.bankName}, settled reserves through the central bank, credited ${receipt.recipient}.`
          : `${sent} — internal: booked inside ${from.account.bankName}, no reserves moved.`;
      }}
    >
      {clients.length === 0 ? (
        <p className="text-sm text-muted">Nobody has an account yet.</p>
      ) : (
        <>
          <div className="grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <AccountPicker selection={from} currency={currency} label="From" />
            <ArrowRight
              size={20}
              className="hidden self-center text-muted sm:block"
              aria-hidden
            />
            <FieldGroup label="To">
              <Field label="recipient IBAN">
                <input
                  className={`${INPUT_CLASS} font-mono uppercase tabular-nums`}
                  value={toIban}
                  onChange={event => setToIban(event.target.value)}
                  placeholder="XX00 0000 0000 0000 00"
                />
              </Field>
            </FieldGroup>
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
