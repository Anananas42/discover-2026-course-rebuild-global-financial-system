import Big from 'big.js';
import { HandCoins } from 'lucide-react';
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

// Lending is to a person — the claim is keyed by their personal id — so
// the banker first picks the client, then which of the client's accounts
// at this bank receives the deposit (a person may hold several here).

interface Bank {
  id: number;
  name: string;
}

interface ClientAccountRow {
  id: number;
  owner: string;
  personId: string;
  iban: string;
}

export function LendToClientDialog({
  bank,
  accounts,
  currency,
  interestRate,
}: {
  /** The bank currently selected on the screen — the lender. */
  bank: Bank | undefined;
  /** The bank's client accounts, as its books list them. */
  accounts: ClientAccountRow[];
  currency: string;
  /** This bank's lending rate, as a ratio string ('0.10' = 10%);
   *  undefined while no bank's books are loaded. */
  interestRate: string | undefined;
}) {
  const [personId, setPersonId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const percent =
    interestRate === undefined
      ? "this bank's"
      : `${new Big(interestRate).times(100).toString()}%`;

  const persons: { personId: string; name: string }[] = [];
  for (const account of accounts) {
    if (!persons.some(person => person.personId === account.personId)) {
      persons.push({ personId: account.personId, name: account.owner });
    }
  }
  const person =
    persons.find(candidate => candidate.personId === personId) ?? persons[0];
  const theirAccounts = accounts.filter(
    account => account.personId === person?.personId
  );
  const selected =
    theirAccounts.find(account => String(account.id) === accountId) ??
    theirAccounts[0];

  return (
    <OperationDialog
      trigger={
        <>
          <HandCoins size={16} /> Lend to a client
        </>
      }
      title="Lend to a client"
      description={`Creates a deposit: credits the client's account and records the bank's claim — the amount plus ${percent} interest, the bank's income. Needs reserves; the central bank requires them to cover client deposits.`}
      runLabel="Lend"
      onRun={async () => {
        if (!bank || !person || !selected) {
          throw new Error('There is no client to lend to yet.');
        }
        const { totalDebt } = await api.banks.lendToClient.mutate({
          bankId: bank.id,
          accountId: selected.id,
          amount,
        });
        const narration = `Lent ${formatMoney(amount)} ${currency} to ${person.name} (${person.personId}) — credited ${formatIban(selected.iban)}; with ${percent} interest booked to ${bank.name}'s own account, their debt is now ${formatMoney(totalDebt)} ${currency}.`;
        setAmount('');
        return narration;
      }}
    >
      {!bank || persons.length === 0 ? (
        <p className="text-sm text-muted">
          No clients yet — accounts are opened from the People tab.
        </p>
      ) : (
        <>
          <Field label="client">
            <Select
              value={person?.personId ?? ''}
              onValueChange={next => {
                setPersonId(next);
                setAccountId('');
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {persons.map(candidate => (
                  <SelectItem
                    key={candidate.personId}
                    value={candidate.personId}
                  >
                    <span className="font-mono tabular-nums">
                      {candidate.personId}
                    </span>{' '}
                    <span className="text-muted">|</span> {candidate.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="account">
            <Select
              value={String(selected?.id ?? '')}
              onValueChange={setAccountId}
            >
              <SelectTrigger className="font-mono tabular-nums">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {theirAccounts.map(account => (
                  <SelectItem
                    key={account.id}
                    value={String(account.id)}
                    className="font-mono tabular-nums"
                  >
                    {formatIban(account.iban)}
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
