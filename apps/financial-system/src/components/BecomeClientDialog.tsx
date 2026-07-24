import { UserPlus } from 'lucide-react';
import { useState } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@banks/shared/browser/ui/select.tsx';

import { api } from '../api.ts';
import { Field, INPUT_CLASS } from './Field.tsx';
import { OperationDialog } from './OperationDialog.tsx';

// A new person enters the financial system: the personal id is the
// person, not a bank's client number — like a birth number, one per
// person, the same at every bank — generated here only because this is
// where a person first exists in the system. Names are labels — a
// second Alice is welcome; the personal id tells them apart.

interface Bank {
  id: number;
  name: string;
}

export function BecomeClientDialog({
  banks,
  onCreated,
}: {
  banks: Bank[];
  /** Lets the screen switch its identity to the new person. */
  onCreated?: (created: { personId: string; owner: string }) => void;
}) {
  const [owner, setOwner] = useState('');
  const [bankId, setBankId] = useState('');
  const selected = banks.find(bank => String(bank.id) === bankId) ?? banks[0];

  return (
    <OperationDialog
      trigger={
        <>
          <UserPlus size={16} /> Become a client
        </>
      }
      title="Become a client"
      description="A new person: registered under their personal id, with a first account at the bank they choose."
      runLabel="Open account"
      onRun={async () => {
        if (!selected)
          throw new Error('There is no bank to open an account at yet.');
        const account = await api.user.becomeClient.mutate({
          bankId: selected.id,
          name: owner,
        });
        setOwner('');
        onCreated?.(account);
        return `${account.owner} (${account.personId}) is now a client of ${selected.name}.`;
      }}
    >
      {banks.length === 0 ? (
        <p className="text-sm text-muted">
          No banks yet — open one on the Commercial Bank tab first.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label="name">
            <input
              className={INPUT_CLASS}
              value={owner}
              onChange={event => setOwner(event.target.value)}
              placeholder="Alice"
            />
          </Field>
          <Field label="bank">
            <Select
              value={String(selected?.id ?? '')}
              onValueChange={setBankId}
            >
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
        </div>
      )}
    </OperationDialog>
  );
}
