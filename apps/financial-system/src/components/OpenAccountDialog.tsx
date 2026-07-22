import { Wallet } from 'lucide-react';
import { useState } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@banks/shared/browser/ui/select.tsx';

import { api } from '../api.ts';
import { Field } from './Field.tsx';
import { OperationDialog } from './OperationDialog.tsx';

// The selected person opens another account — at a new bank or a second
// one at a bank they already use; the bank issues a fresh number either
// way.

interface Bank {
  id: number;
  name: string;
}

export function OpenAccountDialog({
  person,
  banks,
}: {
  /** The identity currently selected on the screen. */
  person: { personId: string; name: string } | undefined;
  banks: Bank[];
}) {
  const [bankId, setBankId] = useState('');
  const selected = banks.find(bank => String(bank.id) === bankId) ?? banks[0];

  return (
    <OperationDialog
      trigger={
        <>
          <Wallet size={16} /> Open another account
        </>
      }
      title={`Open another account for ${person?.name ?? '…'}`}
      description="Opens a further account for you — at any bank, including one you already use."
      runLabel="Open account"
      onRun={async () => {
        if (!person) throw new Error('There is nobody selected yet.');
        if (!selected)
          throw new Error('There is no bank to open an account at yet.');
        await api.user.openAccount.mutate({
          bankId: selected.id,
          personId: person.personId,
        });
        return `Opened another account for ${person.name} at ${selected.name}.`;
      }}
    >
      {banks.length === 0 ? (
        <p className="text-sm text-muted">
          No banks yet — open one on the Commercial Bank tab first.
        </p>
      ) : (
        <Field label="bank">
          <Select value={String(selected?.id ?? '')} onValueChange={setBankId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {banks.map(bank => (
                <SelectItem key={bank.id} value={String(bank.id)}>
                  {bank.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
    </OperationDialog>
  );
}
