import Big from 'big.js';
import { ArrowRight, Repeat } from 'lucide-react';
import { useState } from 'react';

import { api } from '../api.ts';
import { formatMoney } from '../format.ts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@banks/shared/browser/ui/select.tsx';

import type { PickerAccount } from './AccountPicker.tsx';
import { AccountPicker, useAccountSelection } from './AccountPicker.tsx';
import { Field, INPUT_CLASS } from './Field.tsx';
import { OperationDialog } from './OperationDialog.tsx';

// Internal transfer: the bank is chosen first — an internal transfer
// happens *within* one institution — then sender and recipient are
// picked the same way, person then account, both scoped to that bank.
// The server still makes the internal ruling from the IBAN; this dialog
// just can't produce anything but internal.

export function SendMoneyInternalDialog({
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
  const [bankId, setBankId] = useState('');
  const [amount, setAmount] = useState('');

  const banks: { bankId: number; bankName: string }[] = [];
  for (const client of clients) {
    if (!banks.some(bank => bank.bankId === client.bankId)) {
      banks.push({ bankId: client.bankId, bankName: client.bankName });
    }
  }
  // Default to the bank holding the selected person's richest account.
  const preferredBankId = clients
    .filter(client => client.personId === defaultPersonId)
    .slice()
    .sort((a, b) => new Big(b.balance).cmp(a.balance))[0]?.bankId;
  const bank =
    banks.find(candidate => String(candidate.bankId) === bankId) ??
    banks.find(candidate => candidate.bankId === preferredBankId) ??
    banks[0];

  const atBank = clients.filter(client => client.bankId === bank?.bankId);
  const from = useAccountSelection(atBank, {
    preferredPersonId: defaultPersonId,
  });
  const to = useAccountSelection(
    atBank.filter(client => from.account && client.iban !== from.account.iban),
    { preselect: false }
  );

  // Moving the sender onto the recipient's account swaps the two sides:
  // the recipient takes over the sender's old account instead of being
  // silently bumped to another one.
  const swapIfTaken = (nextIban: string | undefined) => {
    if (from.account && to.account && nextIban === to.account.iban) {
      to.selectPerson(from.account.personId);
      to.selectAccount(from.account.iban);
    }
  };
  const fromSelection = {
    ...from,
    selectPerson: (personId: string) => {
      // A person switch resolves to their richest account — same rule as
      // useAccountSelection.
      swapIfTaken(
        atBank
          .filter(client => client.personId === personId)
          .sort((a, b) => new Big(b.balance).cmp(a.balance))[0]?.iban
      );
      from.selectPerson(personId);
    },
    selectAccount: (iban: string) => {
      swapIfTaken(iban);
      from.selectAccount(iban);
    },
  };

  return (
    <OperationDialog
      trigger={
        <>
          <Repeat size={16} /> Send money (internal)
        </>
      }
      title={`Send money within ${bank?.bankName ?? 'your bank'}`}
      description="Transfers to another client of the same bank — money moves inside the bank's own database, no reserves involved."
      runLabel="Send"
      wide
      onRun={async () => {
        if (!from.account) {
          throw new Error('There is no account to send from yet.');
        }
        if (!to.account) {
          throw new Error('Pick the recipient first.');
        }
        const receipt = await api.user.sendMoney.mutate({
          personId: from.account.personId,
          fromBankId: from.account.bankId,
          fromAccountId: from.account.accountId,
          toIban: to.account.iban,
          amount,
        });
        const narration = `Sent ${formatMoney(amount)} ${currency} to ${receipt.recipient} — internal: booked inside ${from.account.bankName}, no reserves moved.`;
        setAmount('');
        return narration;
      }}
    >
      {clients.length === 0 ? (
        <p className="text-sm text-muted">Nobody has an account yet.</p>
      ) : (
        <>
          <Field label="bank">
            <Select
              value={String(bank?.bankId ?? '')}
              onValueChange={setBankId}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {banks.map(candidate => (
                  <SelectItem
                    key={candidate.bankId}
                    value={String(candidate.bankId)}
                  >
                    {candidate.bankName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {from.accounts.length === 0 ? (
            <p className="text-sm text-muted">
              Nobody has an account at {bank?.bankName} yet.
            </p>
          ) : to.persons.length === 0 ? (
            <p className="text-sm text-muted">
              Nobody else has an account at {bank?.bankName} yet.
            </p>
          ) : (
            <>
              <div className="grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
                <AccountPicker
                  selection={fromSelection}
                  currency={currency}
                  label="From"
                />
                <ArrowRight
                  size={20}
                  className="hidden self-center text-muted sm:block"
                  aria-hidden
                />
                <AccountPicker selection={to} currency={currency} label="To" />
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
        </>
      )}
    </OperationDialog>
  );
}
