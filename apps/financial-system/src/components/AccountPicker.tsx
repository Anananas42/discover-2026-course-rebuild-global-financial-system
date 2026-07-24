import Big from 'big.js';
import { useState } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@banks/shared/browser/ui/select.tsx';

import { formatIban, formatMoney } from '../format.ts';
import { Field, FieldGroup } from './Field.tsx';

// The one way an account is picked anywhere: first the person
// (personal id | name), then one of their accounts, listed by IBAN with
// its balance and sorted richest-first — so the default pick is the
// account most able to pay.

export interface PickerAccount {
  bankId: number;
  bankName: string;
  accountId: number;
  personId: string;
  owner: string;
  iban: string;
  balance: string;
}

export interface AccountSelection {
  persons: { personId: string; name: string }[];
  person: { personId: string; name: string } | undefined;
  accounts: PickerAccount[];
  account: PickerAccount | undefined;
  selectPerson: (personId: string) => void;
  selectAccount: (iban: string) => void;
}

export function useAccountSelection(
  clients: PickerAccount[],
  options: { preferredPersonId?: string; preselect?: boolean } = {}
): AccountSelection {
  const { preferredPersonId, preselect = true } = options;
  const [personId, setPersonId] = useState('');
  const [accountIban, setAccountIban] = useState('');

  const persons: { personId: string; name: string }[] = [];
  for (const client of clients) {
    if (!persons.some(person => person.personId === client.personId)) {
      persons.push({ personId: client.personId, name: client.owner });
    }
  }
  // Without preselect the person stays unchosen until an explicit pick —
  // a recipient must never be someone who merely happened to be first.
  const person =
    persons.find(candidate => candidate.personId === personId) ??
    (preselect
      ? (persons.find(candidate => candidate.personId === preferredPersonId) ??
        persons[0])
      : undefined);
  const accounts = clients
    .filter(client => client.personId === person?.personId)
    .slice()
    .sort((a, b) => new Big(b.balance).cmp(a.balance));
  const account =
    accounts.find(candidate => candidate.iban === accountIban) ??
    (person ? accounts[0] : undefined);

  return {
    persons,
    person,
    accounts,
    account,
    selectPerson: (next: string) => {
      setPersonId(next);
      setAccountIban('');
    },
    selectAccount: setAccountIban,
  };
}

export function AccountPicker({
  selection,
  currency,
  label,
}: {
  selection: AccountSelection;
  currency: string;
  /** The party this picker selects — "From", "To". */
  label: string;
}) {
  return (
    <FieldGroup label={label}>
      <Field label="person">
        <Select
          value={selection.person?.personId ?? ''}
          onValueChange={selection.selectPerson}
        >
          <SelectTrigger>
            <SelectValue placeholder="choose a person…" />
          </SelectTrigger>
          <SelectContent>
            {selection.persons.map(person => (
              <SelectItem key={person.personId} value={person.personId}>
                <span className="font-mono tabular-nums">
                  {person.personId}
                </span>{' '}
                <span className="text-muted">|</span> {person.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="account">
        <Select
          value={selection.account?.iban ?? ''}
          onValueChange={selection.selectAccount}
          disabled={!selection.person}
        >
          <SelectTrigger className="font-mono tabular-nums">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {selection.accounts.map(account => (
              <SelectItem
                key={account.iban}
                value={account.iban}
                className="font-mono tabular-nums"
              >
                {formatIban(account.iban)}{' '}
                <span className="text-muted">
                  ({formatMoney(account.balance)} {currency})
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </FieldGroup>
  );
}
