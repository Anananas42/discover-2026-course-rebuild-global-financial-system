import { Pencil } from 'lucide-react';
import { useState } from 'react';

import { api } from '../api.ts';
import { Field, INPUT_CLASS } from './Field.tsx';
import { OperationDialog } from './OperationDialog.tsx';

// The name is a label; the personal id and the IBANs are the identity.
// Renaming relabels the person's accounts everywhere — nothing else
// changes, and name collisions are fine.

export function RenamePersonDialog({
  person,
}: {
  person: { personId: string; name: string } | undefined;
}) {
  const [newName, setNewName] = useState('');

  return (
    <OperationDialog
      trigger={<Pencil size={14} />}
      triggerLabel="Rename yourself"
      title={`Rename ${person?.name ?? 'yourself'}`}
      description="Changes your name everywhere it appears — the name is a label; your personal id and IBANs stay the same."
      runLabel="Rename"
      onRun={async () => {
        if (!person) throw new Error('There is nobody to rename yet.');
        const trimmed = newName.trim();
        const { renamedAccounts } = await api.user.rename.mutate({
          personId: person.personId,
          newName: trimmed,
        });
        setNewName('');
        return `You are now ${trimmed} — ${renamedAccounts} ${
          renamedAccounts === 1 ? 'account' : 'accounts'
        } relabeled.`;
      }}
    >
      <Field label="new name">
        <input
          className={INPUT_CLASS}
          value={newName}
          onChange={event => setNewName(event.target.value)}
          placeholder={person?.name}
        />
      </Field>
    </OperationDialog>
  );
}
